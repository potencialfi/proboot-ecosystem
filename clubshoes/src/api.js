export const API_URL = '/clubshoes/api'; 
export const IMG_URL = '/clubshoes/images';

export const apiCall = async (endpoint, method = 'GET', body = null) => {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);
  
  try {
    const res = await fetch(`${API_URL}${endpoint}`, options);
    const contentType = res.headers.get("content-type");
    if (!contentType || contentType.indexOf("application/json") === -1) {
       throw new Error("Сервер не отвечает корректно.");
    }
    const data = await res.json();
    
    if (!res.ok) {
       const error = new Error(data.message || 'Ошибка сервера');
       error.field = data.field; 
       throw error;
    }
    return data;
  } catch (err) {
    throw err;
  }
};

export const uploadBrandLogo = async (file, brandName) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            try {
                const res = await apiCall('/upload-logo', 'POST', {
                    image: reader.result,
                    brandName: brandName
                });
                resolve(res.fileName);
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = error => reject(error);
    });
};