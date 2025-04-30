document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    document.querySelectorAll('.sidebar a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = e.target.dataset.section;
            showSection(section);
        });
    });

    // Asset Type Management
    document.getElementById('create-asset-type').addEventListener('click', () => {
        showModal('asset-type-modal');
    });

    document.getElementById('add-field').addEventListener('click', () => {
        addFieldToForm();
    });

    document.getElementById('asset-type-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('asset-type-name').value;
        const fields = Array.from(document.querySelectorAll('.field-row')).map(row => ({
            name: row.querySelector('.field-name').value,
            type: row.querySelector('.field-type').value
        }));

        try {
            await window.api.createAssetType({
                name,
                fields,
                default_sort_field: fields[0]?.name,
                default_sort_asc: true
            });
            closeModal('asset-type-modal');
            loadAssetTypes();
        } catch (error) {
            console.error('Failed to create asset type:', error);
            alert('Failed to create asset type. Please try again.');
        }
    });

    // Initial load
    loadDashboard();
    loadAssetTypes();
});

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(sectionId).style.display = 'block';
}

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function addFieldToForm() {
    const fieldsContainer = document.getElementById('asset-type-fields');
    const fieldRow = document.createElement('div');
    fieldRow.className = 'field-row';
    fieldRow.innerHTML = `
        <input type="text" class="field-name" placeholder="Field Name" required>
        <select class="field-type" required>
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="file">File</option>
        </select>
        <button type="button" class="btn-secondary remove-field">Remove</button>
    `;
    fieldsContainer.appendChild(fieldRow);

    fieldRow.querySelector('.remove-field').addEventListener('click', () => {
        fieldRow.remove();
    });
}

async function loadDashboard() {
    try {
        const assetTypes = await window.api.getAssetTypes();
        const stats = {
            totalAssetTypes: assetTypes.length,
            totalAssets: 0
        };

        for (const type of assetTypes) {
            const assets = await window.api.getAssets(type.id);
            stats.totalAssets += assets.length;
        }

        const statsContainer = document.querySelector('.dashboard-stats');
        statsContainer.innerHTML = `
            <div class="stat-card">
                <h3>Total Asset Types</h3>
                <p>${stats.totalAssetTypes}</p>
            </div>
            <div class="stat-card">
                <h3>Total Assets</h3>
                <p>${stats.totalAssets}</p>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load dashboard:', error);
    }
}

async function loadAssetTypes() {
    try {
        const assetTypes = await window.api.getAssetTypes();
        const container = document.querySelector('.asset-type-list');
        container.innerHTML = '';

        assetTypes.forEach(type => {
            const card = document.createElement('div');
            card.className = 'asset-type-card';
            card.innerHTML = `
                <h3>${type.name}</h3>
                <p>Fields: ${type.fields.map(f => f.name).join(', ')}</p>
                <button class="btn-secondary" onclick="viewAssets('${type.id}')">View Assets</button>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Failed to load asset types:', error);
    }
}

async function viewAssets(typeId) {
    try {
        const assets = await window.api.getAssets(typeId);
        const container = document.querySelector('.asset-list');
        container.innerHTML = '';

        assets.forEach(asset => {
            const card = document.createElement('div');
            card.className = 'asset-card';
            card.innerHTML = `
                <h3>${asset.field_values.name || 'Unnamed Asset'}</h3>
                <div class="asset-details">
                    ${Object.entries(asset.field_values)
                        .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
                        .join('')}
                </div>
            `;
            container.appendChild(card);
        });

        showSection('assets');
    } catch (error) {
        console.error('Failed to load assets:', error);
    }
} 