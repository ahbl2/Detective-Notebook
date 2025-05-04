// AssetTable.js - A modular, reusable table component with advanced features
class AssetTable {
    constructor(config) {
        this.config = {
            container: config.container,
            fields: config.fields || [],
            data: config.data || [],
            assetTypeId: config.assetTypeId,
            onSave: config.onSave || (() => {}),
            onDelete: config.onDelete || (() => {}),
            onFileUpload: config.onFileUpload || (() => {})
        };

        this.init();
    }

    init() {
        this.initTable();
        this.initFilePond();
        this.initLocationModal();
    }

    initTable() {
        const columns = this.config.fields.map(field => ({
            title: field.label,
            field: field.name,
            editor: this.getEditorForField(field),
            formatter: this.getFormatterForField(field),
            headerFilter: true,
            headerFilterFunc: this.getFilterForField(field)
        }));

        this.table = new Tabulator(this.config.container, {
            data: this.config.data,
            columns: columns,
            layout: "fitColumns",
            pagination: "local",
            paginationSize: 10,
            paginationSizeSelector: [10, 25, 50, 100],
            movableColumns: true,
            resizableColumns: true,
            addRowPos: "top",
            history: true,
            layoutColumnsOnNewData: true,
            responsiveLayout: "collapse",
            tooltips: true,
            selectable: true,
            rowContextMenu: this.getContextMenu(),
            rowClick: (e, row) => {
                if (row.getData()._editing) {
                    row.reformat();
                }
            }
        });

        // Add search functionality
        this.addSearchBar();
    }

    getEditorForField(field) {
        switch (field.type) {
            case 'text':
                return 'input';
            case 'textarea':
                return 'textarea';
            case 'number':
                return 'number';
            case 'date':
                return 'date';
            case 'time':
                return 'time';
            case 'datetime':
                return 'datetime';
            case 'dropdown':
                return (cell) => {
                    const editor = document.createElement('select');
                    field.options.forEach(option => {
                        const opt = document.createElement('option');
                        opt.value = option.value;
                        opt.textContent = option.label;
                        editor.appendChild(opt);
                    });
                    return editor;
                };
            case 'checkbox':
                return 'tickCross';
            case 'url':
                return 'input';
            case 'file':
                return (cell) => {
                    const button = document.createElement('button');
                    button.className = 'file-upload-button';
                    button.textContent = 'Upload File';
                    button.onclick = (e) => {
                        e.preventDefault();
                        this.openFileUploadModal(cell.getRow());
                    };
                    return button;
                };
            case 'location':
                return (cell) => {
                    const button = document.createElement('button');
                    button.className = 'location-picker-button';
                    button.textContent = 'Pick Location';
                    button.onclick = (e) => {
                        e.preventDefault();
                        this.openLocationModal(cell.getRow());
                    };
                    return button;
                };
            default:
                return 'input';
        }
    }

    getFormatterForField(field) {
        switch (field.type) {
            case 'checkbox':
                return 'tickCross';
            case 'url':
                return (cell) => {
                    const value = cell.getValue();
                    return value ? `<a href="${value}" target="_blank">${value}</a>` : '';
                };
            case 'file':
                return (cell) => {
                    const value = cell.getValue();
                    return value ? `<a href="${value}" target="_blank">View File</a>` : '';
                };
            case 'location':
                return (cell) => {
                    const value = cell.getValue();
                    if (!value) return '';
                    const { address, lat, lng } = value;
                    return `${address} (${lat}, ${lng})`;
                };
            default:
                return 'plaintext';
        }
    }

    getFilterForField(field) {
        switch (field.type) {
            case 'number':
                return '>=';
            case 'date':
            case 'datetime':
                return '>=';
            case 'dropdown':
                return 'like';
            default:
                return 'like';
        }
    }

    initFilePond() {
        this.filePond = FilePond.create(document.createElement('input'), {
            allowMultiple: false,
            maxFiles: 1,
            server: {
                url: '/api/files',
                process: {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }
            }
        });
    }

    initLocationModal() {
        this.locationModal = document.createElement('div');
        this.locationModal.className = 'location-modal';
        this.locationModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Select Location</h3>
                    <button class="close-button">&times;</button>
                </div>
                <div class="search-container">
                    <input type="text" class="location-search" placeholder="Search address...">
                </div>
                <div id="location-map"></div>
            </div>
        `;
        document.body.appendChild(this.locationModal);

        this.map = L.map('location-map').setView([0, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
        this.geocoder = L.Control.Geocoder.nominatim();
        this.marker = L.marker([0, 0]).addTo(this.map);
    }

    openFileUploadModal(row) {
        const modal = document.createElement('div');
        modal.className = 'file-upload-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Upload File</h3>
                    <button class="close-button">&times;</button>
                </div>
                <div class="file-upload-container"></div>
            </div>
        `;

        const container = modal.querySelector('.file-upload-container');
        this.filePond.element = container;
        
        this.filePond.on('processfile', (error, file) => {
            if (!error) {
                const fileData = {
                    path: file.serverId,
                    filename: file.filename,
                    assetId: row.getData().id,
                    assetTypeId: this.config.assetTypeId
                };
                this.config.onFileUpload(fileData);
                modal.remove();
            }
        });

        document.body.appendChild(modal);
    }

    openLocationModal(row) {
        this.locationModal.style.display = 'block';
        const searchInput = this.locationModal.querySelector('.location-search');
        const closeButton = this.locationModal.querySelector('.close-button');

        searchInput.onkeyup = (e) => {
            if (e.key === 'Enter') {
                this.geocoder.geocode(searchInput.value, (results) => {
                    if (results && results.length > 0) {
                        const { lat, lng } = results[0].center;
                        this.map.setView([lat, lng], 15);
                        this.marker.setLatLng([lat, lng]);
                    }
                });
            }
        };

        this.map.on('click', (e) => {
            const { lat, lng } = e.latlng;
            this.marker.setLatLng([lat, lng]);
            this.geocoder.reverse(lat, lng, (result) => {
                if (result && result.length > 0) {
                    const address = result[0].name;
                    row.update({
                        location: {
                            address,
                            lat,
                            lng
                        }
                    });
                }
            });
        });

        closeButton.onclick = () => {
            this.locationModal.style.display = 'none';
        };
    }

    addSearchBar() {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'table-search-container';
        searchContainer.innerHTML = `
            <input type="text" class="table-search" placeholder="Search...">
            <button class="export-csv">Export CSV</button>
        `;

        const searchInput = searchContainer.querySelector('.table-search');
        const exportButton = searchContainer.querySelector('.export-csv');

        searchInput.onkeyup = () => {
            this.table.setFilter('all', 'like', searchInput.value);
        };

        exportButton.onclick = () => {
            this.table.download('csv', 'data.csv');
        };

        this.config.container.parentNode.insertBefore(searchContainer, this.config.container);
    }

    getContextMenu() {
        return [
            {
                label: "Edit Row",
                action: (e, row) => {
                    row.toggleEdit();
                }
            },
            {
                label: "Delete Row",
                action: (e, row) => {
                    if (confirm('Are you sure you want to delete this row?')) {
                        this.config.onDelete(row.getData());
                        row.delete();
                    }
                }
            }
        ];
    }

    // Public methods
    setData(data) {
        this.table.setData(data);
    }

    addRow(data) {
        this.table.addRow(data);
    }

    updateRow(id, data) {
        const row = this.table.getRow(id);
        if (row) {
            row.update(data);
        }
    }

    deleteRow(id) {
        const row = this.table.getRow(id);
        if (row) {
            row.delete();
        }
    }
}

// Export the class
export default AssetTable; 