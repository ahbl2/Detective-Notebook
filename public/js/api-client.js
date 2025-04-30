class APIClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  async getAssetTypes() {
    const response = await fetch(`${this.baseUrl}/api/asset-types`);
    if (!response.ok) {
      throw new Error('Failed to fetch asset types');
    }
    return response.json();
  }

  async createAssetType(assetType) {
    const response = await fetch(`${this.baseUrl}/api/asset-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(assetType)
    });
    if (!response.ok) {
      throw new Error('Failed to create asset type');
    }
    return response.json();
  }

  async getAssets(typeId) {
    const response = await fetch(`${this.baseUrl}/api/assets/${typeId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch assets');
    }
    return response.json();
  }

  async createAsset(asset) {
    const response = await fetch(`${this.baseUrl}/api/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(asset)
    });
    if (!response.ok) {
      throw new Error('Failed to create asset');
    }
    return response.json();
  }

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/api/files`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      throw new Error('Failed to upload file');
    }
    return response.json();
  }
}

// Create a global instance
window.api = new APIClient(); 