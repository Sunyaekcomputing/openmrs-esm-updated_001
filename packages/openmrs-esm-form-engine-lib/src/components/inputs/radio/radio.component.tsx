import React, { useEffect, useState ,useMemo} from 'react';

import { useTranslation } from 'react-i18next';
import { FormGroup, RadioButtonGroup, RadioButton } from '@carbon/react';
import { type FormFieldInputProps } from '../../../types';
import { isTrue } from '../../../utils/boolean-utils';
import { shouldUseInlineLayout } from '../../../utils/form-helper';
import { useFormProviderContext } from '../../../provider/form-provider';
import FieldLabel from '../../field-label/field-label.component';
import FieldValueView from '../../value/view/field-value-view.component';
import styles from './radio.scss';

const Radio: React.FC<FormFieldInputProps> = ({ field, value, errors, warnings, setFieldValue }) => {
  const { t } = useTranslation();
  const { layoutType, sessionMode, workspaceLayout, formFieldAdapters, getFieldValueById, evaluateExpression } = useFormProviderContext() as any;

  const handleChange = (selectedValue: any) => {
    setFieldValue(selectedValue);

    // Reset dependent questions if any
    const fieldAny = field as any;
    if (fieldAny.dependentQuestions?.length) {
      fieldAny.dependentQuestions.forEach((depId: string) => {
        (layoutType as any).setFieldValueById?.(depId, null);
      });
    }
  };

  

  const [prevCheckboxValues, setPrevCheckboxValues] = useState<string[]>([]);
  
 

 

  useEffect(() => {
    console.log(`[Radio] useEffect triggered for field: ${field.id}`);
    console.log(`[Radio] Current radio value:`, value);
    
  
    const fields = (layoutType as any)?.fields || [];
    console.log('[Radio] All form fields:', fields.map((f: any) => ({ id: f.id, type: f.type, label: f.label })));
  
    // Filter checkbox fields
    const checkboxFields = (layoutType?.fields || []).filter(
      (f: any) => f.type === 'obs' && f.questionOptions?.rendering === 'checkbox'
    );
    
    console.log('[Radio] Checkbox fields found:', checkboxFields.map(f => f.id));
    

    console.log("santosh", checkboxFields);
    console.log('[Radio] Checkbox fields found:', checkboxFields.map((f: any) => f.id));
  
    // Get current selected values from all checkbox fields
    const currentCheckboxValues: string[] = checkboxFields.flatMap((checkboxField: any) => {
      let val;
      try {
        val = getFieldValueById ? getFieldValueById(checkboxField.id) : undefined;
        console.log(`[Radio] Value for checkbox ${checkboxField.id}:`, val);
      } catch (err) {
        console.warn(`[Radio] Failed to get value for ${checkboxField.id}:`, err);
      }
      return Array.isArray(val) ? val : [];
    });
  
    console.log('[Radio] Previous checkbox values:', prevCheckboxValues);
    console.log('[Radio] Current checkbox values:', currentCheckboxValues);
  
    // Compare previous vs current
    const hasChanged =
      currentCheckboxValues.some(v => !prevCheckboxValues.includes(v)) ||
      prevCheckboxValues.some(v => !currentCheckboxValues.includes(v));
  
    if (hasChanged) {
      console.log('[Radio] Checkbox changed, resetting radio value to 0');
      setFieldValue(null);
    }
  
    setPrevCheckboxValues(currentCheckboxValues);
  }, [value, field, getFieldValueById, layoutType, setFieldValue]);
  
  
  
  
  
  
  
  
  
  
  
  const isInline = useMemo(() => {
    if (['view', 'embedded-view'].includes(sessionMode) || isTrue(field.readonly)) {
      return shouldUseInlineLayout(field.inlineRendering, layoutType, workspaceLayout, sessionMode);
    }
    return false;
  }, [sessionMode, field.readonly, field.inlineRendering, layoutType, workspaceLayout]);

  return sessionMode === 'view' || sessionMode === 'embedded-view' || isTrue(field.readonly) ? (
    <FieldValueView
      label={t(field.label)}
      value={value !== null && value !== undefined ? formFieldAdapters[field.type].getDisplayValue(field, value) : value}
      conceptName={field.meta?.concept?.display}
      isInline={isInline}
    />
  ) : (
    !field.isHidden && (
      <FormGroup
        legendText={<FieldLabel field={field} />}
        className={styles.boldedLegend}
        disabled={field.isDisabled}
        invalid={errors?.length > 0}>
       <RadioButtonGroup
  name={field.id}
  valueSelected={value || ''}
  onChange={handleChange}
  readOnly={isTrue(field.readonly)}
  orientation={field.questionOptions?.orientation || 'vertical'}>
  {field.questionOptions.answers
    .filter(answer => !answer.isHidden)
    .map((answer, index) => (
      <RadioButton
        id={`${field.id}-${answer.label}`}
        labelText={t(answer.label) ?? ''}
        value={answer.concept}
        key={index}
        data-testid={`${field.id}-answer-${answer.label}`}
        onClick={(e) => {
          e.preventDefault();
          if (value === answer.concept) {
            setFieldValue(null);
          } else {
            setFieldValue(answer.concept);
          }
        }}
      />
    ))}
</RadioButtonGroup>

        {(errors?.length > 0 || warnings?.length > 0) && (
          <div>
            <div className={styles.errorMessage}>
              {errors.length > 0
                ? errors[0].message
                : warnings.length > 0
                ? warnings[0].message
                : null}
            </div>
          </div>
        )}
      </FormGroup>
    )
  );
};

export default Radio;
