import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FieldType, bitable } from "@lark-base-open/js-sdk";
import { useTranslation } from 'react-i18next';
import clipboardCopy from 'clipboard-copy';
import { Empty, Button, Select, Spin, Toast} from '@douyinfe/semi-ui';
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations';
import { ExifData, Field, FieldMapping, CellValueItem } from './types';
import { translateExifKeys, fetchExifData } from './utils';
import './App.css';

  const App: React.FC = () => {
    const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
    const [exifData, setExifData] = useState<ExifData | null>(null);
    const [fieldMappings, setFieldMappings] = useState<FieldMapping>({});
    const [fields, setFields] = useState<Field[]>([]);
    const [copySuccessMessage] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [updating, setUpdating] = useState<boolean>(false);
    const [updateSuccess] = useState<string>('');
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const { t } = useTranslation();


    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    const translateExifKeysCallback = useCallback(translateExifKeys, []);

    const copyExifData = () => {
      if (textAreaRef.current) {
        textAreaRef.current.select();
        clipboardCopy(textAreaRef.current.value)
          .then(() => Toast.success(t('exifCopied')))
          .catch(() => Toast.error(t('copyFailed')));
      }
    };

    const updateFieldMapping = (exifKey: string, fieldId: string) => {
      setFieldMappings(prevMappings => {
        const newMappings = { ...prevMappings, [exifKey]: fieldId };
        localStorage.setItem('fieldMappings', JSON.stringify(newMappings));
        return newMappings;
      });
    };


    const updateExifInfoToFields = async () => {
      setUpdating(true);

      try {
        const selection = await bitable.base.getSelection();
        if (!selection.tableId || !selection.recordId) {
          throw new Error(t('noSelection'));
        }

        const table = await bitable.base.getTableById(selection.tableId);

        // 明确地定义 fieldsToUpdate 的类型
        let fieldsToUpdate: { [key: string]: string } = {};
        for (const [exifKey, fieldId] of Object.entries(fieldMappings)) {
          if (exifData && exifData[exifKey] && fieldId) {
            fieldsToUpdate[fieldId] = exifData[exifKey].toString();
          }
        }

        if (Object.keys(fieldsToUpdate).length === 0) {
          throw new Error(t('noDataToUpdate'));
        }

        // 使用单个 setRecords 调用更新所有字段
        await table.setRecords([
          {
            recordId: selection.recordId,
            fields: fieldsToUpdate
          }
        ]);

        Toast.success(t('updateSuccessMessage'));
      } catch (error) {
        console.error('更新字段错误: ', error);
        Toast.error(`${t('updateFailed')}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setUpdating(false);
      }
    };


    const getAttachments = async (tableId: string, recordId: string, fieldId: string) => {
      setLoading(true);
      try {
        const table = await bitable.base.getTableById(tableId);
        const cellValue = await table.getCellValue(fieldId, recordId);
        if (Array.isArray(cellValue) && cellValue.length > 0)  {
          const tokens = cellValue.map(item => (item as CellValueItem).token);
          const urls = await table.getCellAttachmentUrls(tokens, fieldId, recordId);
          setAttachmentUrls(urls);
          setCurrentImageIndex(0);

          if (urls.length > 0) {
            const data = await fetchExifData(urls[0]);
            if (typeof data === 'object' && data !== null) {  // 检查 data 是否为 null 或 undefined
              setExifData(data as ExifData);
            } else {
              setExifData(null);
            }
          } else {
            setExifData(null);
          }
        } else {
          setExifData(null);
        }
      } catch (error) {
        console.error('get attachment url error: ', error);
        setExifData(null);
      } finally {
        setLoading(false);
      }
    };

    const loadNextImageExifData = async () => {
      if (currentImageIndex < attachmentUrls.length - 1) {
        const newIndex = currentImageIndex + 1;
        setCurrentImageIndex(newIndex);
        const data = await fetchExifData(attachmentUrls[newIndex]);
        setExifData(data as ExifData);
      } else {
        Toast.info(t('lastImage'));
      }
    };

    const loadPreviousImageExifData = async () => {
      if (currentImageIndex > 0) {
        const newIndex = currentImageIndex - 1;
        setCurrentImageIndex(newIndex);
        const data = await fetchExifData(attachmentUrls[newIndex]);
        setExifData(data as ExifData);
      } else {
        Toast.info(t('firstImage'));
      }
    };




    useEffect(() => {
      const exifText = Object.entries(exifData || {}).map(([key, value]) => `${key}: ${value}`).join('\n');
      if (textAreaRef.current) textAreaRef.current.value = exifText;
    }, [exifData]);

    useEffect(() => {
      const fetchFields = async () => {
        const table = await bitable.base.getActiveTable();
        const fields = await table.getFieldMetaList();
        const textFields = fields.filter(field => field.type === FieldType.Text);
        setFields(textFields);
      };

      fetchFields();
    }, []);

    useEffect(() => {
      const savedFieldMappings = localStorage.getItem('fieldMappings');
      if (savedFieldMappings) {
        setFieldMappings(JSON.parse(savedFieldMappings));
      }
    }, []);

    useEffect(() => {
      const getInfo = async () => {
        const selection = await bitable.base.getSelection();
        if (selection.recordId && selection.fieldId) {
          await getAttachments(selection.tableId!, selection.recordId!, selection.fieldId!);
        }
      };
      const unsubscribe = bitable.base.onSelectionChange(() => getInfo());
      getInfo();
      return unsubscribe;
    }, []);

return (
  <div className="App">
    {loading && (
      <div className="loading-container">
        <Spin size="large" /> 
        <div>{t('loading')}</div>
      </div>
    )}
    {updating && (
      <div className="loading-container">
        <Spin size="large" />
        <div>{t('updating')}</div>
      </div>
    )}
    {updateSuccess && <div className="update-success-message">{t('updateSuccess')}</div>}
        {exifData ? (
          <div className="exif-container">
            <h3>{t('photoInfo')}</h3>
            <ul>
              {Object.entries(exifData).map(([key, value]) => (
                <li key={key}>
                  {key}: {value}
                  <Select
                    className="select-field"
                    placeholder={t('selectField')}
                    value={fieldMappings[key] || undefined} // 设置Select的值为当前字段映射的值
                    onChange={(fieldId) => updateFieldMapping(key, fieldId as string)}
                  >
                    {fields.map(field => (
                      <Select.Option key={field.id} value={field.id}>{field.name}</Select.Option>
                    ))}
                  </Select>
                </li>
              ))}
            </ul>
        <div className="button-container">
          <Button onClick={copyExifData} block>{t('copyInfo')}</Button>
          <Button onClick={updateExifInfoToFields} block>{t('updateInfoToFields')}</Button>
          {attachmentUrls.length > 1 && (
            <>
              <Button 
                onClick={loadPreviousImageExifData} 
                block
                disabled={currentImageIndex === 0}
              >{t('prevImage')}
              </Button>
              <Button 
                onClick={loadNextImageExifData} 
                block
                disabled={currentImageIndex === attachmentUrls.length - 1}
              >{t('nextImage')}
              </Button>
            </>
          )}
        </div>
      </div>
    ) : (
      <Empty
        image={<IllustrationNoContent style={{ width: 150, height: 150 }} />}
        darkModeImage={<IllustrationNoContentDark style={{ width: 150, height: 150 }} />}
        description={t('choosePictureCell')}
      />
    )}
    {copySuccessMessage && <div className="copy-success-message">{copySuccessMessage}</div>}
    <textarea ref={textAreaRef} aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: '1px', width: '1px', overflow: 'hidden' }} />
  </div>
);
  };

export default App;