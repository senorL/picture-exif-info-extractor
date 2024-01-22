import ExifReader from 'exifreader';

const formatDegrees = (degrees: any, minutes: any, rawSeconds: any, direction: any) => {
  // 确保 rawSeconds 是数字类型
  const secondsNum = parseFloat(rawSeconds);
  const seconds = isNaN(secondsNum) ? 0 : secondsNum / 100;

  return `${degrees}° ${minutes}' ${seconds.toFixed(2)}" ${direction}`;
};

export const formatGPSData = (gpsData: any, gpsRef: any) => {
  if (!gpsData || !gpsData.value || gpsData.value.length !== 3) return '';

  const degrees = gpsData.value[0];
  const minutes = gpsData.value[1];
  const rawSeconds = gpsData.value[2];
  const direction = gpsRef ? gpsRef.value[0] : '';

  return formatDegrees(degrees, minutes, rawSeconds, direction);
};

export const formatExifValue = (key: any, value: any, gpsRef: any) => {
  if (value && typeof value === 'object') {
    if (key === "GPSLatitude" || key === "GPSLongitude") {
      return formatGPSData(value, gpsRef);
    }
    if (value.description) {
      return value.description;
    }
    return JSON.stringify(value);
  }

  return value;
};

export const translateExifKeys = (exifData: any) => {
  const exifKeyMap = {
    "Image Width": "Width/宽度",
    "Image Height": "Height/图片高度",
    "Make": "Make/制造商",
    "Model": "Model/相机型号",
    "DateTimeOriginal": "Time/拍摄时间",
    "ExposureTime": "ExposureTime/曝光时间",
    "GPSLatitude": "GPSLatitude/纬度",
    "GPSLongitude": "GPSLongitude/经度",
    // ... 其他映射 ...
  };

  const translatedExifData: { [key: string]: any } = {};

  for (const [key, translatedKey] of Object.entries(exifKeyMap)) {
    const value = exifData[key];
    const refKey = key + 'Ref';
    const refValue = exifData[refKey];

    if (value !== undefined) {
      translatedExifData[translatedKey] = formatExifValue(key, value, refValue);
    }
  }

  return translatedExifData;
};

export const fetchExifData = async (url: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    const tags = await ExifReader.load(arrayBuffer);
    const translatedTags = translateExifKeys(tags);

    // 如果有Exif信息，返回翻译后的标签；否则获取并返回图片尺寸
    if (Object.keys(translatedTags).length > 0) {
      return translatedTags;
    } else {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve({ "图片宽度": img.width, "图片高度": img.height });
        };
        img.src = URL.createObjectURL(blob);
      });
    }
  } catch (error) {
    console.error('Error fetching EXIF data: ', error);
    return null;
  }
};
