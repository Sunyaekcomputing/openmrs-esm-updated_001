import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionMenuButton, DocumentIcon, launchWorkspace, useWorkspaces } from '@openmrs/esm-framework';
import { clinicalFormsWorkspace, formEntryWorkspace, htmlFormEntryWorkspace } from '@openmrs/esm-patient-common-lib';

const ClinicalFormActionButton: React.FC = () => {
  const { t } = useTranslation();
  const { workspaces } = useWorkspaces();

  const formEntryWorkspaces = workspaces.filter((w) => w.name === formEntryWorkspace);
  const recentlyOpenedForm = formEntryWorkspaces[0];

  const htmlFormEntryWorkspaces = workspaces.filter((w) => w.name === htmlFormEntryWorkspace);
  const recentlyOpenedHtmlForm = htmlFormEntryWorkspaces[0];

  const isFormOpen = formEntryWorkspaces?.length >= 1;
  const isHtmlFormOpen = htmlFormEntryWorkspaces?.length >= 1;

  const launchPatientWorkspaceCb = () => {
    if (isFormOpen) {
      launchWorkspace(formEntryWorkspace, {
        workspaceTitle: recentlyOpenedForm?.additionalProps?.['workspaceTitle'],
        // optionally force visitUuid to null to skip popup
        additionalProps: { visitUuid: null },
      });
    } else if (isHtmlFormOpen) {
      launchWorkspace(htmlFormEntryWorkspace, {
        workspaceTitle: recentlyOpenedHtmlForm?.additionalProps?.['workspaceTitle'],
        additionalProps: { visitUuid: null },
      });
    } else {
      // directly launch the forms workspace without requiring a visit
      launchWorkspace(clinicalFormsWorkspace, { additionalProps: { visitUuid: null } });
    }
  };

  return (
    <ActionMenuButton
      getIcon={(props: ComponentProps<typeof DocumentIcon>) => <DocumentIcon {...props} />}
      label={t('clinicalForms', 'Clinical forms')}
      iconDescription={t('clinicalForms', 'Clinical forms')}
      handler={launchPatientWorkspaceCb}
      type={'clinical-form'}
    />
  );
};

export default ClinicalFormActionButton;
