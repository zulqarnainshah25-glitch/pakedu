import React from 'react';
import { User } from 'firebase/auth';
import { DemoUserSession } from '../utils/authAndSso';
import { CVBuilderModule } from '../features/cv-builder/CVBuilderModule';

interface AtlierCvToolProps {
  currentUser: User | null;
  demoSession: DemoUserSession | null;
  onOpenAuthModal: (mode?: 'signin' | 'signup') => void;
  onSignOutToPortalLogin: () => void;
}

export const AtlierCvTool: React.FC<AtlierCvToolProps> = ({
  currentUser,
  demoSession,
  onOpenAuthModal,
  onSignOutToPortalLogin: _onSignOutToPortalLogin,
}) => {
  return (
    <div className="space-y-6">
      <CVBuilderModule
        currentUser={currentUser}
        demoSession={demoSession}
        onRequestSignIn={() => onOpenAuthModal('signin')}
      />
    </div>
  );
};
