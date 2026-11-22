import type { Express } from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  cleanCVDocumentText,
  cleanText,
  enforceConciseSummary,
  expandRawDutiesToProfessionalBullets,
  inferLanguageProficiencyAndPercentage,
  inferSkillTierAndPercentage,
  isNonEnglishOrRomanUrdu,
  rewriteRawSummaryToEnglish,
  stripSampleResidue
} from '../features/cv-builder/lib/textSanitizer';

const CV_WRITER_SYSTEM_PROMPT = `You are an elite executive CV writer and ATS optimization specialist.
Take the user's raw CV data and generate a complete, polished, ATS-friendly CV in 100% fluent, grammatical, professional corporate English.

STRICT RULES:
1. PROFESSIONAL SUMMARY TRANSLATION & POLISHING (3 TO 5 LINES / 60-95 WORDS):
   - If the user writes their summary in Roman Urdu, Urdu script, Hindi, Roman Hindi, or broken English, you MUST translate and synthesize it into 100% fluent, authoritative, executive corporate English.
   - NEVER output Roman Urdu, Urdu script, Hindi, or informal text in the summary.
   - The summary MUST always be a single cohesive paragraph of strictly 3 to 5 comprehensive lines (approximately 60 to 95 words).
   - Base the summary directly on the user's written statement, job title, duties (e.g. teaching, banking, technology, administration), and key skills.
   - Prevent text duplication: never repeat sentences, phrases, or half-strings.
2. ACRONYMS & CAPITALIZATION:
   - Polish raw content (including Roman Urdu, Hindi, or broken English) into strong corporate English using impactful action verbs.
   - Strictly preserve the user's true dates, company names, educational institutions, and contact details without altering facts.
   - Ensure proper nouns and acronyms retain strict standard casing: "AI", "MS Office", "Adobe Photoshop", "SELD", "NBP", "BISE Sukkur", and ensure the first letters of villages, cities, districts, and institutions are properly capitalized.
3. WORK EXPERIENCE POLISHING & BULLET EXPANSION (CRITICAL):
   - Never output the user's raw notes, shorthand lists, comma-separated items, or phrases ending in 'etc.' as bullets.
   - You MUST transform, polish, and expand ANY job experience added by any user into 2 to 4 (minimum 2-3 lines/bullets per experience) comprehensive, executive-level corporate bullet points tailored specifically to that role and organization.
   - Every single bullet point MUST begin with a powerful corporate action verb (e.g., Spearheaded, Administered, Facilitated, Coordinated, Processed, Executed, Delivered, Reconciled, Evaluated, Implemented, Mentored).
4. SKILLS & LANGUAGES STRUCTURING:
   - For Skills: infer level (Expert, Proficient, Intermediate, Basic) and numeric percentage (50-100%).
   - For Languages: infer proficiency (Native / Bilingual, Fluent (C1), Conversational (B1), Basic (A2)) and percentage.
5. STRICT JSON SCHEMA: Output valid JSON only matching schema.`;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms))
  ]);
}

function rewriteRawDescriptionToBullets(
  rawDesc: string,
  role: string,
  company: string
): string[] {
  return expandRawDutiesToProfessionalBullets(rawDesc, role, company);
}

function buildCategorizedSkillGroups(skills: string[]) {
  const cleanSkills = skills.map((s) => cleanText(s, true)).filter(Boolean);
  if (cleanSkills.length === 0) return [];

  if (cleanSkills.length <= 4) {
    return [
      {
        id: 'sg_1',
        category: 'Core Competencies',
        items: cleanSkills
      }
    ];
  }

  const mid = Math.ceil(cleanSkills.length / 2);
  return [
    {
      id: 'sg_1',
      category: 'Core Domain Expertise',
      items: cleanSkills.slice(0, mid)
    },
    {
      id: 'sg_2',
      category: 'Professional & Technical Skills',
      items: cleanSkills.slice(mid)
    }
  ];
}

function sanitizeIncomingFormCV(rawCV: Record<string, unknown>) {
  const stripped = stripSampleResidue(rawCV as any);
  const removed = new Set(Array.isArray(stripped.removedFields) ? stripped.removedFields : []);

  const experience = removed.has('experience')
    ? []
    : (Array.isArray(stripped.experience) ? stripped.experience : [])
        .filter(
          (e: any) =>
            cleanText(e.company) ||
            cleanText(e.role) ||
            cleanText(e.rawDescription)
        )
        .map((e: any, idx: number) => ({
          id: e.id || `exp_${idx + 1}`,
          company: cleanText(e.company),
          role: cleanText(e.role),
          startDate: cleanText(e.startDate),
          endDate: cleanText(e.endDate),
          rawDescription: cleanText(e.rawDescription),
          bullets: []
        }));

  const education = removed.has('education')
    ? []
    : (Array.isArray(stripped.education) ? stripped.education : [])
        .filter((e: any) => cleanText(e.degree) || cleanText(e.institution) || cleanText(e.majorSubject))
        .map((e: any, idx: number) => ({
          id: e.id || `edu_${idx + 1}`,
          degree: cleanText(e.degree),
          majorSubject: cleanText(e.majorSubject),
          institution: cleanText(e.institution),
          year: cleanText(e.year),
          details: cleanText(e.details)
        }));

  const projects = removed.has('projects')
    ? []
    : (Array.isArray(stripped.projects) ? stripped.projects : [])
        .filter((p: any) => cleanText(p.name) || cleanText(p.description))
        .map((p: any, idx: number) => ({
          id: p.id || `proj_${idx + 1}`,
          name: cleanText(p.name),
          roleOrTech: cleanText(p.roleOrTech),
          link: cleanText(p.link),
          description: cleanText(p.description)
        }));

  const rawSkillItems = Array.isArray(stripped.skills) ? stripped.skills : [];
  const skills = removed.has('skills')
    ? []
    : rawSkillItems
        .map((s: any) =>
          typeof s === 'object' && s !== null && s.name ? cleanText(s.name) : cleanText(s)
        )
        .filter(Boolean);

  const rawSkillLevels: any[] = [
    ...(Array.isArray(stripped.skillLevels) ? stripped.skillLevels : []),
    ...rawSkillItems.filter((s: any) => typeof s === 'object' && s !== null && s.name)
  ];

  const skillLevels = removed.has('skills')
    ? []
    : skills.map((skillName: string, idx: number) => {
        const match: any = rawSkillLevels.find(
          (s: any) => s && cleanText(s.name).toLowerCase() === skillName.toLowerCase()
        );
        const { level, percentage } = inferSkillTierAndPercentage(
          skillName,
          match?.level || match?.proficiency,
          match?.percentage,
          idx
        );
        return {
          name: skillName,
          level,
          proficiency: level,
          percentage
        };
      });

  const rawLangItems = Array.isArray(stripped.languages) ? stripped.languages : [];
  const languages = removed.has('languages')
    ? []
    : rawLangItems
        .map((l: any) =>
          typeof l === 'object' && l !== null && l.name ? cleanText(l.name) : cleanText(l)
        )
        .filter(Boolean);

  const rawLangLevels: any[] = [
    ...(Array.isArray(stripped.languageLevels) ? stripped.languageLevels : []),
    ...rawLangItems.filter((l: any) => typeof l === 'object' && l !== null && l.name)
  ];

  const languageLevels = removed.has('languages')
    ? []
    : languages.map((langName: string, idx: number) => {
        const match: any = rawLangLevels.find(
          (l: any) => l && cleanText(l.name).toLowerCase() === langName.toLowerCase()
        );
        const { proficiency, percentage } = inferLanguageProficiencyAndPercentage(
          langName,
          match?.proficiency || match?.level,
          match?.percentage,
          idx
        );
        return {
          name: langName,
          level: proficiency,
          proficiency,
          percentage
        };
      });

  const certifications = removed.has('certifications')
    ? []
    : (Array.isArray(stripped.certifications) ? stripped.certifications : [])
        .flatMap((c: any) => String(c).split(/[\n,|•;]+/))
        .map((c: string) => cleanText(c).replace(/^[•\-*·|]+\s*/, '').trim())
        .filter(Boolean);

  const references = removed.has('references')
    ? []
    : (Array.isArray(stripped.references) ? stripped.references : [])
        .filter(
          (r: any) =>
            cleanText(r.name) ||
            cleanText(r.designation) ||
            cleanText(r.company) ||
            cleanText(r.contact)
        )
        .map((r: any, idx: number) => ({
          id: r.id || `ref_${idx + 1}`,
          name: cleanText(r.name),
          designation: cleanText(r.designation),
          company: cleanText(r.company),
          contact: cleanText(r.contact)
        }));

  return {
    ...stripped,
    fullName: cleanText(stripped.fullName),
    jobTitle: removed.has('jobTitle') ? '' : cleanText(stripped.jobTitle),
    email: removed.has('email') ? '' : cleanText(stripped.email),
    phone: removed.has('phone') ? '' : cleanText(stripped.phone),
    address: removed.has('address') ? '' : cleanText(stripped.address),
    linkedinUrl: removed.has('linkedinUrl') ? '' : cleanText(stripped.linkedinUrl),
    portfolioUrl: removed.has('portfolioUrl') ? '' : cleanText(stripped.portfolioUrl),
    rawSummary: removed.has('summary')
      ? ''
      : cleanText(stripped.rawSummary || stripped.summary),
    summary: '',
    experience,
    education,
    skills,
    skillLevels,
    skillGroups: [],
    projects,
    languages,
    languageLevels,
    certifications,
    references,
    referencesOnRequest: removed.has('references')
      ? false
      : stripped.referencesOnRequest !== undefined
      ? Boolean(stripped.referencesOnRequest)
      : references.length === 0
  };
}

function buildStructuredFallback(cleanFormCV: Record<string, any>) {
  const removed = new Set(
    Array.isArray(cleanFormCV.removedFields) ? cleanFormCV.removedFields : []
  );

  const summary = removed.has('summary')
    ? ''
    : rewriteRawSummaryToEnglish(
        cleanFormCV.rawSummary || '',
        cleanFormCV.jobTitle || '',
        cleanFormCV.experience || [],
        cleanFormCV.skills || []
      );

  const experience = removed.has('experience')
    ? []
    : (Array.isArray(cleanFormCV.experience) ? cleanFormCV.experience : []).map(
        (exp: any, idx: number) => ({
          ...exp,
          id: exp.id || `exp_${idx + 1}`,
          bullets: rewriteRawDescriptionToBullets(
            exp.rawDescription || '',
            exp.role || '',
            exp.company || ''
          )
        })
      );

  const skills: string[] = removed.has('skills')
    ? []
    : Array.isArray(cleanFormCV.skills)
    ? cleanFormCV.skills.filter(Boolean)
    : [];

  const skillGroups = removed.has('skills') ? [] : buildCategorizedSkillGroups(skills);

  return cleanCVDocumentText({
    ...(cleanFormCV as any),
    summary,
    experience,
    skills,
    skillGroups
  });
}

function mergeAiResultWithFormCV(cleanFormCV: Record<string, any>, aiJson: Record<string, any>) {
  const removed = new Set(
    Array.isArray(cleanFormCV.removedFields) ? cleanFormCV.removedFields : []
  );

  const aiExpList = Array.isArray(aiJson.experiences)
    ? aiJson.experiences
    : Array.isArray(aiJson.experience)
    ? aiJson.experience
    : [];

  const mergedExperience = removed.has('experience')
    ? []
    : (Array.isArray(cleanFormCV.experience) ? cleanFormCV.experience : []).map(
        (origExp: any, idx: number) => {
          const aiExp = aiExpList[idx] || null;
          const aiBullets =
            aiExp && Array.isArray(aiExp.bullets)
              ? aiExp.bullets
                  .flatMap((b: any) => String(b).split(/\n+|•/))
                  .map((b: string) => cleanText(b))
                  .filter(Boolean)
              : [];

          const isUnexpandedRawBullets =
            aiBullets.length === 0 ||
            (aiBullets.length === 1 &&
              (aiBullets[0].split(/\s+/).length <= 2 ||
                /\b(etc\.?|and\s+so\s+on|waghaira)\b/i.test(aiBullets[0]) ||
                aiBullets[0].split(',').length >= 3 ||
                cleanText(aiBullets[0]).toLowerCase() ===
                  cleanText(origExp.rawDescription).toLowerCase() ||
                aiBullets[0].toLowerCase().replace(/[^a-z]/g, '') ===
                  String(origExp.role || '').toLowerCase().replace(/[^a-z]/g, '')));

          const finalBullets =
            isUnexpandedRawBullets || aiBullets.length < 2
              ? expandRawDutiesToProfessionalBullets(
                  origExp.rawDescription || (aiBullets[0] || ''),
                  origExp.role,
                  origExp.company
                )
              : aiBullets;

          return {
            ...origExp,
            company: origExp.company,
            role: origExp.role,
            startDate: origExp.startDate,
            endDate: origExp.endDate,
            bullets: finalBullets
          };
        }
      );

  const mergedEducation = removed.has('education')
    ? []
    : (Array.isArray(cleanFormCV.education) ? cleanFormCV.education : []).map(
        (origEdu: any, idx: number) => {
          const aiEdu = Array.isArray(aiJson.education) ? aiJson.education[idx] : null;
          return {
            ...origEdu,
            degree: origEdu.degree,
            majorSubject: origEdu.majorSubject || cleanText(aiEdu?.majorSubject || ''),
            institution: origEdu.institution,
            year: origEdu.year,
            details: cleanText(aiEdu?.details || origEdu.details)
          };
        }
      );

  const mergedProjects = removed.has('projects')
    ? []
    : (Array.isArray(cleanFormCV.projects) ? cleanFormCV.projects : []).map(
        (origProj: any, idx: number) => {
          const aiProj = Array.isArray(aiJson.projects) ? aiJson.projects[idx] : null;
          return {
            ...origProj,
            name: origProj.name,
            roleOrTech: cleanText(aiProj?.roleOrTech || origProj.roleOrTech),
            link: origProj.link,
            description: cleanText(aiProj?.description || origProj.description)
          };
        }
      );

  const userSkills: string[] = removed.has('skills')
    ? []
    : Array.isArray(cleanFormCV.skills)
    ? cleanFormCV.skills
    : [];

  const aiSkillLevels =
    !removed.has('skills') && Array.isArray(aiJson.skills)
      ? aiJson.skills
          .filter((s: any) => s && typeof s === 'object' && s.name)
          .map((s: any, idx: number) => {
            const name = cleanText(String(s.name));
            const { level, percentage } = inferSkillTierAndPercentage(
              name,
              s.level || s.proficiency,
              s.percentage,
              idx
            );
            return {
              name,
              level,
              proficiency: level,
              percentage
            };
          })
      : [];

  const aiLanguageLevels =
    !removed.has('languages') && Array.isArray(aiJson.languages)
      ? aiJson.languages
          .filter((l: any) => l && typeof l === 'object' && l.name)
          .map((l: any, idx: number) => {
            const name = cleanText(String(l.name));
            const { proficiency, percentage } = inferLanguageProficiencyAndPercentage(
              name,
              l.proficiency || l.level,
              l.percentage,
              idx
            );
            return {
              name,
              level: proficiency,
              proficiency,
              percentage
            };
          })
      : [];

  const aiSkillGroups =
    !removed.has('skills') &&
    userSkills.length > 0 &&
    Array.isArray(aiJson.skillGroups) &&
    aiJson.skillGroups.length > 0
      ? aiJson.skillGroups
          .map((sg: any, idx: number) => ({
            id: sg.id || `sg_${idx + 1}`,
            category: cleanText(sg.category || 'Core Competencies'),
            items: Array.isArray(sg.items)
              ? sg.items.map((i: any) => cleanText(String(i))).filter(Boolean)
              : []
          }))
          .filter((sg: any) => sg.category && sg.items.length > 0)
      : buildCategorizedSkillGroups(userSkills);

  const rawAiSummary = cleanText(aiJson.personal?.summary || aiJson.summary || '');
  const isInvalidAiSummary =
    !rawAiSummary ||
    isNonEnglishOrRomanUrdu(rawAiSummary) ||
    rawAiSummary.split(/\s+/).length < 35;

  const aiSummary = isInvalidAiSummary
    ? rewriteRawSummaryToEnglish(
        cleanFormCV.rawSummary,
        cleanFormCV.jobTitle,
        mergedExperience,
        userSkills
      )
    : enforceConciseSummary(rawAiSummary);

  const mergedCertifications = removed.has('certifications')
    ? []
    : Array.isArray(aiJson.certifications) && aiJson.certifications.length > 0
    ? aiJson.certifications
        .flatMap((c: any) => String(c).split(/[\n,|•;]+/))
        .map((c: string) => cleanText(c).replace(/^[•\-*·|]+\s*/, '').trim())
        .filter(Boolean)
    : cleanFormCV.certifications;

  const mergedSkillLevels =
    aiSkillLevels.length > 0
      ? userSkills.map((sk: string, idx: number) => {
          const userMatch = (cleanFormCV.skillLevels || []).find(
            (sl: any) => cleanText(sl.name).toLowerCase() === cleanText(sk).toLowerCase()
          );
          const aiMatch =
            aiSkillLevels.find(
              (a: any) => cleanText(a.name).toLowerCase() === cleanText(sk).toLowerCase()
            ) || aiSkillLevels[idx];
          return (
            userMatch ||
            aiMatch || {
              name: cleanText(sk),
              level: 'Proficient',
              proficiency: 'Proficient',
              percentage: 85
            }
          );
        })
      : aiSkillLevels;

  const userLangs = cleanFormCV.languages || [];
  const mergedLanguageLevels =
    aiLanguageLevels.length > 0
      ? userLangs.map((lg: string, idx: number) => {
          const userMatch = (cleanFormCV.languageLevels || []).find(
            (ll: any) => cleanText(ll.name).toLowerCase() === cleanText(lg).toLowerCase()
          );
          const aiMatch =
            aiLanguageLevels.find(
              (a: any) => cleanText(a.name).toLowerCase() === cleanText(lg).toLowerCase()
            ) || aiLanguageLevels[idx];
          return (
            userMatch ||
            aiMatch || {
              name: cleanText(lg),
              level: 'Fluent (C1)',
              proficiency: 'Fluent (C1)',
              percentage: 90
            }
          );
        })
      : aiLanguageLevels;

  return cleanCVDocumentText({
    ...(cleanFormCV as any),
    summary: aiSummary,
    experience: mergedExperience,
    education: mergedEducation,
    skills: userSkills,
    skillLevels: mergedSkillLevels,
    skillGroups: aiSkillGroups,
    projects: mergedProjects,
    languages: userLangs,
    languageLevels: mergedLanguageLevels,
    certifications: mergedCertifications
  });
}

export async function handleCvBuild(
  rawCV: any,
  geminiApiKey: string | undefined,
  primaryModel = 'gemini-3.5-flash-lite'
): Promise<{ success: boolean; fallbackUsed: boolean; data: any }> {
  const cleanFormCV = sanitizeIncomingFormCV(rawCV);
  const { photoDataUrl: _photo, ...cvForPrompt } = cleanFormCV;

  // Check if Gemini API is available
  if (geminiApiKey && !geminiApiKey.includes('YOUR_GEMINI_API_KEY')) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const response = await withTimeout(
        ai.models.generateContent({
          model: primaryModel,
          contents: `Rewrite and polish the following user CV form data into fluent, grammatical, professional English JSON:\n${JSON.stringify(
            cvForPrompt,
            null,
            2
          )}`,
          config: {
            systemInstruction: CV_WRITER_SYSTEM_PROMPT,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description: '3-5 lines (60-95 words) in 100% professional corporate English.'
                },
                experiences: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      company: { type: Type.STRING },
                      role: { type: Type.STRING },
                      startDate: { type: Type.STRING },
                      endDate: { type: Type.STRING },
                      bullets: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                      }
                    }
                  }
                },
                education: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      degree: { type: Type.STRING },
                      institution: { type: Type.STRING },
                      year: { type: Type.STRING },
                      details: { type: Type.STRING }
                    }
                  }
                },
                skills: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      level: { type: Type.STRING },
                      percentage: { type: Type.INTEGER }
                    }
                  }
                },
                languages: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      proficiency: { type: Type.STRING },
                      percentage: { type: Type.INTEGER }
                    }
                  }
                }
              }
            }
          }
        }),
        12000
      );

      const rawText = (response.text ?? '').trim();
      if (rawText) {
        const aiJson = JSON.parse(rawText);
        const mergedData = mergeAiResultWithFormCV(cleanFormCV, aiJson);
        return {
          success: true,
          fallbackUsed: false,
          data: mergedData
        };
      }
    } catch (err) {
      console.warn('[CV-API] Gemini call error, falling back to deterministic rewriter:', err);
    }
  }

  // Deterministic English rewriter fallback (instant & offline safe)
  const fallbackData = buildStructuredFallback(cleanFormCV);
  return {
    success: true,
    fallbackUsed: true,
    data: fallbackData
  };
}

export function registerCvBuilderEndpoints(
  app: Express,
  geminiApiKey: string | undefined,
  primaryModel = 'gemini-3.5-flash-lite'
): void {
  app.post('/api/build-cv', async (req, res) => {
    const rawCV = req.body?.cv;
    if (!rawCV) {
      res.status(400).json({ error: 'Missing CV data in request body.' });
      return;
    }

    const result = await handleCvBuild(rawCV, geminiApiKey, primaryModel);
    res.json(result);
  });
}
