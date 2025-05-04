// Import AssetTable
const AssetTable = window.AssetTable;

async function renderAssetTypeSpreadsheetPage(typeId) {
    try {
        const type = await apiService.getAssetType(typeId);
        const assets = await apiService.getAssets(typeId);
        
        // Create container for the table
        entriesContainer.innerHTML = `
            <div class="asset-spreadsheet-page">
                <div class="asset-spreadsheet-header">
                    <h2><i class="fas fa-table"></i> ${type.name}</h2>
                    <button class="add-asset-btn"><i class="fas fa-plus"></i> Add Asset</button>
                </div>
                <div id="asset-table"></div>
            </div>
        `;

        // Convert type fields to AssetTable format
        const fields = type.fields.map(field => ({
            name: field.name,
            label: field.name,
            type: field.type,
            options: field.options || []
        }));

        // Convert assets to AssetTable format
        const data = assets.map(asset => ({
            id: asset.id,
            ...asset.field_values,
            created_at: asset.created_at,
            updated_at: asset.updated_at
        }));

        // Initialize the table
        const table = new AssetTable({
            container: '#asset-table',
            fields: fields,
            data: data,
            assetTypeId: typeId,
            onSave: async (rowData) => {
                const { id, ...field_values } = rowData;
                await handleAssetUpdate({ id }, type, field_values);
            },
            onDelete: async (rowData) => {
                if (confirm('Are you sure you want to delete this asset?')) {
                    await handleAssetDelete(rowData.id);
                }
            },
            onFileUpload: async (fileData) => {
                try {
                    await apiService.uploadFile(fileData);
                    showNotification('File uploaded successfully', 'success');
                } catch (error) {
                    console.error('Error uploading file:', error);
                    showNotification('Error uploading file', 'error');
                }
            }
        });

        // Add event listener for Add Asset button
        const addButton = entriesContainer.querySelector('.add-asset-btn');
        if (addButton) {
            addButton.addEventListener('click', () => {
                const newRow = {
                    id: Date.now().toString(),
                    ...Object.fromEntries(fields.map(f => [f.name, '']))
                };
                try {
                    table.addRow(newRow);
                } catch (error) {
                    console.error('Error adding row:', error);
                    showNotification('Error adding new asset', 'error');
                }
            });
        }

    } catch (error) {
        console.error('Error rendering asset spreadsheet:', error);
        showNotification('Error loading assets', 'error');
    }
} 