// AssetTable.js
// Modular, professional asset table component using Tabulator, FilePond, and Leaflet
// Usage: import AssetTable from './AssetTable.js';
// Then: new AssetTable({ ...config })

// Required: Tabulator, FilePond, Leaflet, and Leaflet Control Geocoder CDNs in your HTML

export default class AssetTable {
    constructor({
        container, // DOM element or selector
        fields = [], // [{ name, label, type, ... }]
        data = [], // initial row data
        onSaveRow = null, // async (rowData) => {}
        onDeleteRow = null, // async (rowData) => {}
        onAddRow = null, // async (rowData) => {}
        fileUploadUrl = '/api/files', // endpoint for file uploads
        ...options
    }) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.fields = fields;
        this.data = data;
        this.onSaveRow = onSaveRow;
        this.onDeleteRow = onDeleteRow;
        this.onAddRow = onAddRow;
        this.fileUploadUrl = fileUploadUrl;
        this.options = options;
        this._init();
    }

    _init() {
        this._buildColumns();
        this._renderTable();
        this._setupFilePondModal();
        this._setupLocationModal();
    }

    _buildColumns() {
        this.columns = this.fields.map(field => {
            let col = {
                title: field.label || field.name,
                field: field.name,
                headerFilter: true,
                editor: false,
                formatter: false,
                ...field.tabulatorOptions
            };
            // Editor/formatter by type
            switch (field.type) {
                case 'text':
                case 'textarea':
                    col.editor = 'input';
                    break;
                case 'number':
                    col.editor = 'number';
                    break;
                case 'date':
                    col.editor = 'input';
                    col.editorParams = { type: 'date' };
                    break;
                case 'time':
                    col.editor = 'input';
                    col.editorParams = { type: 'time' };
                    break;
                case 'datetime':
                    col.editor = 'input';
                    col.editorParams = { type: 'datetime-local' };
                    break;
                case 'dropdown':
                    col.editor = 'select';
                    col.editorParams = { values: field.options || [] };
                    break;
                case 'checkbox':
                    col.editor = true;
                    col.formatter = 'tickCross';
                    break;
                case 'url':
                    col.editor = 'input';
                    col.formatter = (cell) => {
                        const val = cell.getValue();
                        return val ? `<a href="${val}" target="_blank">${val}</a>` : '';
                    };
                    break;
                case 'file':
                    col.editor = this._fileEditor.bind(this, field);
                    col.formatter = this._fileFormatter.bind(this, field);
                    break;
                case 'location':
                    col.editor = this._locationEditor.bind(this, field);
                    col.formatter = this._locationFormatter.bind(this, field);
                    break;
                default:
                    col.editor = 'input';
            }
            return col;
        });
        // Add actions column
        this.columns.push({
            title: 'Actions',
            field: 'actions',
            hozAlign: 'center',
            headerSort: false,
            formatter: (cell) => `
                <button class="btn-save">💾</button>
                <button class="btn-delete">🗑️</button>
            `,
            cellClick: (e, cell) => {
                const row = cell.getRow();
                if (e.target.classList.contains('btn-save')) this._handleSaveRow(row);
                if (e.target.classList.contains('btn-delete')) this._handleDeleteRow(row);
            }
        });
    }

    _renderTable() {
        this.table = new Tabulator(this.container, {
            data: this.data,
            columns: this.columns,
            layout: 'fitColumns',
            pagination: 'local',
            paginationSize: 10,
            movableColumns: true,
            resizableRows: true,
            height: 'auto',
            ...this.options,
        });
        // Add search bar
        this._addSearchBar();
        // Add export button
        this._addExportButton();
        // Add add-row button
        this._addAddRowButton();
    }

    _addSearchBar() {
        const searchDiv = document.createElement('div');
        searchDiv.className = 'asset-table-search';
        searchDiv.innerHTML = `<input type="text" placeholder="Search..." class="search-input">`;
        this.container.parentElement.insertBefore(searchDiv, this.container);
        searchDiv.querySelector('.search-input').addEventListener('input', (e) => {
            this.table.setFilter((row) => {
                const val = e.target.value.toLowerCase();
                return Object.values(row.getData()).some(v => String(v).toLowerCase().includes(val));
            });
        });
    }

    _addExportButton() {
        const btn = document.createElement('button');
        btn.textContent = 'Export CSV';
        btn.className = 'asset-table-export';
        btn.onclick = () => this.table.download('csv', 'assets.csv');
        this.container.parentElement.insertBefore(btn, this.container.nextSibling);
    }

    _addAddRowButton() {
        const btn = document.createElement('button');
        btn.textContent = 'Add Row';
        btn.className = 'asset-table-add-row';
        btn.onclick = () => {
            const newRow = {};
            this.fields.forEach(f => newRow[f.name] = '');
            this.table.addRow(newRow, true);
            if (this.onAddRow) this.onAddRow(newRow);
        };
        this.container.parentElement.insertBefore(btn, this.container.nextSibling);
    }

    // --- FilePond integration ---
    _setupFilePondModal() {
        // Create modal for file upload
        this.fileModal = document.createElement('div');
        this.fileModal.className = 'filepond-modal';
        this.fileModal.style.display = 'none';
        this.fileModal.innerHTML = `
            <div class="filepond-modal-content">
                <input type="file" class="filepond-input" />
                <button class="filepond-close">Close</button>
            </div>
        `;
        document.body.appendChild(this.fileModal);
        this.filePondInput = this.fileModal.querySelector('.filepond-input');
        this.filePond = FilePond.create(this.filePondInput, {
            server: this.fileUploadUrl
        });
        this.fileModal.querySelector('.filepond-close').onclick = () => {
            this.fileModal.style.display = 'none';
            this.filePond.removeFiles();
        };
    }
    _fileEditor(field, cell, onRendered, success, cancel) {
        // Open FilePond modal
        this.fileModal.style.display = 'block';
        this.filePondInput.onchange = () => {
            const file = this.filePondInput.files[0];
            if (file) {
                // After upload, set value as { path, name }
                // You may need to hook into FilePond's process event for real upload
                success({ path: file.serverId || file.name, name: file.name });
                this.fileModal.style.display = 'none';
                this.filePond.removeFiles();
            }
        };
    }
    _fileFormatter(field, cell) {
        const value = cell.getValue();
        if (!value) return '';
        const fileName = value.name || (typeof value === 'string' ? value : 'File');
        const filePath = value.path || value;
        return `<a href="${filePath}" download="${fileName}"><i class="fas fa-download"></i> ${fileName}</a>`;
    }

    // --- Leaflet integration for location ---
    _setupLocationModal() {
        // Create modal for map
        this.locationModal = document.createElement('div');
        this.locationModal.className = 'location-modal';
        this.locationModal.style.display = 'none';
        this.locationModal.innerHTML = `
            <div class="location-modal-content">
                <div id="map" style="height:400px;"></div>
                <input type="text" class="location-search" placeholder="Search address..." />
                <button class="location-save">Save</button>
                <button class="location-close">Close</button>
            </div>
        `;
        document.body.appendChild(this.locationModal);
        this.locationMap = null;
        this.locationMarker = null;
        this.locationModal.querySelector('.location-close').onclick = () => {
            this.locationModal.style.display = 'none';
        };
    }
    _locationEditor(field, cell, onRendered, success, cancel) {
        // Open map modal
        this.locationModal.style.display = 'block';
        setTimeout(() => {
            if (!this.locationMap) {
                this.locationMap = L.map('map').setView([37.8, -96], 4);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors'
                }).addTo(this.locationMap);
                this.locationMarker = L.marker([37.8, -96], { draggable: true }).addTo(this.locationMap);
                if (window.L.Control && window.L.Control.Geocoder) {
                    L.Control.geocoder({
                        defaultMarkGeocode: false
                    })
                        .on('markgeocode', e => {
                            const latlng = e.geocode.center;
                            this.locationMap.setView(latlng, 16);
                            this.locationMarker.setLatLng(latlng);
                        })
                        .addTo(this.locationMap);
                }
            }
            this.locationMap.invalidateSize();
        }, 100);
        this.locationModal.querySelector('.location-save').onclick = () => {
            const latlng = this.locationMarker.getLatLng();
            // You may want to reverse geocode here for address
            success({ lat: latlng.lat, lng: latlng.lng, address: '' });
            this.locationModal.style.display = 'none';
        };
    }
    _locationFormatter(field, cell) {
        const value = cell.getValue();
        if (!value) return '';
        if (typeof value === 'object' && value.lat && value.lng) {
            return `<span><i class="fas fa-map-marker-alt"></i> (${value.lat.toFixed(4)}, ${value.lng.toFixed(4)})</span>`;
        }
        return value;
    }

    // --- Row actions ---
    async _handleSaveRow(row) {
        const rowData = row.getData();
        if (this.onSaveRow) await this.onSaveRow(rowData);
        this.table.updateData([rowData]);
    }
    async _handleDeleteRow(row) {
        const rowData = row.getData();
        if (this.onDeleteRow) await this.onDeleteRow(rowData);
        this.table.deleteRow(row);
    }
} 