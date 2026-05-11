// V1.0
// image.js
// 圖片處理工具

export const compressImage = (file) => {
  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.readAsDataURL(file);

    reader.onload = (event) => {

      const img = new Image();

      img.src = event.target.result;

      img.onload = () => {

        const canvas = document.createElement('canvas');

        const MAX_WIDTH = 800;

        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0, width, height);

        resolve(
          canvas.toDataURL('image/jpeg', 0.6)
        );
      };

      img.onerror = (error) => reject(error);
    };

    reader.onerror = (error) => reject(error);
  });
};