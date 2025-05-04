// AssetTableExample.js - Example usage of the AssetTable component

import AssetTable from '../components/AssetTable.js';

// Example field configuration
const fields = [
    {
        name: 'name',
        label: 'Name',
        type: 'text'
    },
    {
        name: 'description',
        label: 'Description',
        type: 'textarea'
    },
    {
        name: 'quantity',
        label: 'Quantity',
        type: 'number'
    },
    {
        name: 'purchaseDate',
        label: 'Purchase Date',
        type: 'date'
    },
    {
        name: 'status',
        label: 'Status',
        type: 'dropdown',
        options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'maintenance', label: 'Maintenance' }
        ]
    },
    {
        name: 'isAvailable',
        label: 'Available',
        type: 'checkbox'
    },
    {
        name: 'documentation',
        label: 'Documentation',
        type: 'file'
    },
    {
        name: 'location',
        label: 'Location',
        type: 'location'
    }
];

// Example data
const data = [
    {
        id: '1',
        name: 'Laptop',
        description: 'Dell XPS 15',
        quantity: 5,
        purchaseDate: '2023-01-15',
        status: 'active',
        isAvailable: true,
        documentation: null,
        location: null
    },
    {
        id: '2',
        name: 'Projector',
        description: 'Epson PowerLite',
        quantity: 2,
        purchaseDate: '2023-02-20',
        status: 'active',
        isAvailable: true,
        documentation: null,
        location: null
    }
];

// Initialize the table
const table = new AssetTable({
    container: '#asset-table',
    fields: fields,
    data: data,
    assetTypeId: 'equipment',
    onSave: (rowData) => {
        console.log('Saving row:', rowData);
        // Implement your save logic here
    },
    onDelete: (rowData) => {
        console.log('Deleting row:', rowData);
        // Implement your delete logic here
    },
    onFileUpload: (fileData) => {
        console.log('File uploaded:', fileData);
        // Implement your file upload logic here
    }
});

// Example of adding a new row
document.getElementById('add-row').addEventListener('click', () => {
    table.addRow({
        id: Date.now().toString(),
        name: '',
        description: '',
        quantity: 0,
        purchaseDate: new Date().toISOString().split('T')[0],
        status: 'active',
        isAvailable: true,
        documentation: null,
        location: null
    });
}); 