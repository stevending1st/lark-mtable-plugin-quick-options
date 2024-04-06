import './App.css';
import { bitable, FieldType, IFieldMeta, IMultiSelectField, ISingleSelectField, ITable, ITableMeta } from "@lark-base-open/js-sdk";
import { Button, Form, Modal, Toast, } from '@douyinfe/semi-ui';
import { BaseFormApi } from '@douyinfe/semi-foundation/lib/es/form/interface';
import { IconExport } from '@douyinfe/semi-icons';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next'

export default function App() {
  const { t } = useTranslation();

  const [tableMetaList, setTableMetaList] = useState<ITableMeta[]>();
  const [selectFieldList, setSelectFields] = useState<IFieldMeta[]>();

  const [updateLoading, setUpdateLoading] = useState<boolean>(false);

  const currentTable = useRef<ITable>();
  const currentField = useRef<ISingleSelectField | IMultiSelectField>();
  const formApi = useRef<BaseFormApi>();

  const getSelectFields = async (tableIdOrName: string) => {
    currentTable.current = await bitable.base.getTable(tableIdOrName);
    const fields = await currentTable.current?.getFieldMetaList();
    return fields.filter(({ type }) => type === FieldType.SingleSelect || type === FieldType.MultiSelect)
  }

  const changeTable = async (tableIdOrName: string) => {
    formApi.current?.setValue("field", undefined)
    const selectFields = tableIdOrName ? await getSelectFields(tableIdOrName) : [];
    setSelectFields(selectFields);
  }

  const getSelectFieldOptions = async (fieldNameOrId: string) => {
    currentField.current = await currentTable.current?.getField<ISingleSelectField | IMultiSelectField>(fieldNameOrId);
    const options = await currentField.current?.getOptions();

    const optionsText = options?.reduce((pre, { name }) => pre + name + "\n", "");
    formApi.current?.setValue("options", optionsText);
  }

  const optionDifferential = (oldOptions: string[], newOptions: string[]) => {
    const oldOptionSet = new Set(oldOptions);
    const newOptionSet = new Set(newOptions);

    const deleteOptions = oldOptions.filter(item => !newOptionSet.has(item));

    const addOptions = newOptions.filter(item => !oldOptionSet.has(item));
    const addOptionsStringArr: string[] = [];
    new Set(addOptions).forEach((value) => addOptionsStringArr.push(value));

    return { delete: deleteOptions, add: addOptionsStringArr }
  }

  const changeOptions = async (addArr: string[], deleteArr: string[]) => {
    for (const name of deleteArr) {
      await currentField.current?.deleteOption(name)
    }

    await currentField.current?.addOptions(addArr.map(name => ({ name })));

    Toast.success({
      content: t('update_completion_prompt'),
      duration: 3,
      theme: 'light',
    })

    formApi.current?.setValue("options", undefined);
    formApi.current?.setValue("field", undefined);

    setUpdateLoading(false);
  }

  const addRecord = useCallback(async ({ options }: { options: string }) => {
    const form = formApi.current;
    if (!form?.getValue('table') || !form?.getValue('field')) {
      const modal = Modal.error({
        title: !form?.getValue('table') ? t('no_table_selected_prompt') : t('no_field_selected_prompt'),
        footer:
          <Button type="danger" onClick={() => modal.destroy()}>
            {t('i_know')}
          </Button>,
        width: 350
      });

      return;
    }

    setUpdateLoading(() => true);

    const newOptionArr = options?.split("\n").filter(value => !!value) || [];
    const oldOptionArr = (await currentField.current?.getOptions()) || [];

    const { delete: deleteArr, add: addArr } = optionDifferential(oldOptionArr.map(({ name }) => name), newOptionArr)

    if (deleteArr.length > 0) {
      const modal = Modal.error({
        title: t('delete_item_confirmation'),
        content: <div>
          <p>{t('delete_item_confirmation_description')}</p>
          <ul style={{ listStyleType: "square", marginLeft: "1rem" }}>{deleteArr.map((name, index) => <li key={name + index}>{name}</li>)}</ul>
        </div>,
        width: 350,
        onOk: () => { modal.destroy(); changeOptions(addArr, deleteArr) },
        onCancel: () => { modal.destroy(); setUpdateLoading(false); },
      });
    } else {
      changeOptions(addArr, deleteArr);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const metaList = await bitable.base.getTableMetaList();
      const selection = await bitable.base.getSelection();
      setTableMetaList(metaList);
      formApi.current?.setValues({ table: selection.tableId });
      const { table: tableId } = formApi.current?.getValues();
      const selectFields = tableId ? await getSelectFields(tableId) : [];
      setSelectFields(selectFields);
    })()
  }, []);

  return (
    <main className="main">
      <h4>{t('title')}</h4>

      <Form labelPosition='top' onSubmit={addRecord} getFormApi={(baseFormApi: BaseFormApi) => formApi.current = baseFormApi}
      >
        <Form.Select field='table' label={t('select_table')} placeholder={t('select_table_placeholder')} style={{ width: '100%' }}
          onChange={(value) => changeTable(value as string)}>
          {
            Array.isArray(tableMetaList) && tableMetaList.map(({ name, id }) => {
              return (
                <Form.Select.Option key={id} value={id}>
                  {name}
                </Form.Select.Option>
              );
            })
          }
        </Form.Select>

        <Form.Select field='field' label={t('select_field')} placeholder={t('select_field_placeholder')} style={{ width: '100%' }}
          onChange={(value) => getSelectFieldOptions(value as string)}
        >
          {
            Array.isArray(selectFieldList) && selectFieldList.map(({ name, id }) => {
              return (
                <Form.Select.Option key={id} value={id}>
                  {name}
                </Form.Select.Option>
              );
            })
          }
        </Form.Select>

        <Form.TextArea
          style={{ width: '100%' }}
          field='options'
          label={t('options')}
          placeholder={t('options_placeholder')}
        />

        <Button icon={<IconExport />} loading={updateLoading} theme='solid' htmlType='submit'>{t('submit_button')}</Button>
      </Form>
    </main>
  )
}
