// DOM Elements
const categoryList = document.querySelector('.category-list');
const entriesContainer = document.querySelector('.entries-container');
const searchContainer = document.querySelector('.search-container');
const entryModal = document.getElementById('entry-modal');
const entryForm = document.getElementById('entry-form');
const addEntryBtn = document.querySelector('.add-entry-btn');
const closeModalBtn = document.querySelector('.close-modal');
const cancelBtn = document.querySelector('.cancel-btn');
const portableIndicator = document.querySelector('.portable-mode-indicator span');

// State
let currentCategory = null;
let entries = [];
let config = null;
let currentEntryId = null;
let currentFilePath = null;
let currentFiles = [];
let pendingFiles = [];
let categories = [];
let currentPage = 1;
let itemsPerPage = 15;
let currentFavoritesPage = 1;
const favoritesPerPage = 15;
let currentFavoritesSort = 'title';
let currentCategorySort = 'title';

// Category Settings Modal Management
let selectedCategoryId = null;

// Section Management
let currentSection = 'guide';
let guideDropdownOpen = false;

// Asset Manager navigation state
let assetManagerView = 'list'; // 'list' or 'type'
let selectedAssetTypeId = null;

// Add these at the top of the file with other state variables
let currentAssetSortField = null;
let currentAssetSortAsc = true;
let editingCategory = null;

// API Configuration
const API_BASE_URL = window.location.origin + '/api';
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// API Service
const apiService = {
    // Auth
    async getCurrentUser() {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to get current user');
        return response.json();
    },

    // Categories
    async getCategories() {
        const response = await fetch(`${API_BASE_URL}/categories`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to get categories');
        return response.json();
    },

    async addCategory(category) {
        const response = await fetch(`${API_BASE_URL}/categories`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(category)
        });
        if (!response.ok) throw new Error('Failed to add category');
        return response.json();
    },

    async updateCategory(category) {
        const response = await fetch(`${API_BASE_URL}/categories/${category.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(category)
        });
        if (!response.ok) throw new Error('Failed to update category');
        return response.json();
    },

    async deleteCategory(categoryId) {
        const response = await fetch(`${API_BASE_URL}/categories/${categoryId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to delete category');
        return response.json();
    },

    // Entries
    async getEntries(categoryId) {
        const response = await fetch(`${API_BASE_URL}/entries?categoryId=${categoryId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to get entries');
        return response.json();
    },

    async addEntry(entry) {
        const response = await fetch(`${API_BASE_URL}/entries`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(entry)
        });
        if (!response.ok) throw new Error('Failed to add entry');
        return response.json();
    },

    async updateEntry(entry) {
        const response = await fetch(`${API_BASE_URL}/entries/${entry.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(entry)
        });
        if (!response.ok) throw new Error('Failed to update entry');
        return response.json();
    },

    async deleteEntry(entryId) {
        if (!entryId) return;
        
        const response = await fetch(`${API_BASE_URL}/entries/${entryId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to delete entry');
        return response.json();
    },

    // Files
    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/files`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        if (!response.ok) throw new Error('Failed to upload file');
        return response.json();
    },

    async downloadFile(filePath) {
        const response = await fetch(`${API_BASE_URL}/files/download/${encodeURIComponent(filePath)}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to download file');
        return response.blob();
    },

    async deleteFile(fileId) {
        const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to delete file');
        return response.json();
    },

    // Ratings
    async getRatings(entryId) {
        const response = await fetch(`${API_BASE_URL}/ratings?entryId=${entryId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to get ratings');
        return response.json();
    },

    async addRating(rating) {
        const response = await fetch(`${API_BASE_URL}/ratings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(rating)
        });
        if (!response.ok) throw new Error('Failed to add rating');
        return response.json();
    },

    // Comments
    async getComments(entryId) {
        const response = await fetch(`${API_BASE_URL}/comments?entryId=${entryId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to get comments');
        return response.json();
    },

    async addComment(comment) {
        const response = await fetch(`${API_BASE_URL}/comments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(comment)
        });
        if (!response.ok) throw new Error('Failed to add comment');
        return response.json();
    },

    // Configuration methods
    async getConfig() {
        const response = await fetch(`${API_BASE_URL}/config`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to get config');
        return response.json();
    },

    async updateConfig(config) {
        const response = await fetch(`${API_BASE_URL}/config`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        if (!response.ok) throw new Error('Failed to update config');
        return response.json();
    },

    // Export/Import methods
    async exportData(deviceId) {
        const response = await fetch(`${API_BASE_URL}/export`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ deviceId })
        });
        if (!response.ok) throw new Error('Failed to export data');
        return response.blob();
    },

    async importData(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/import`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        if (!response.ok) throw new Error('Failed to import data');
        return response.json();
    },

    // Asset Types methods
    async getAssetTypes() {
        const response = await fetch(`${API_BASE_URL}/asset-types`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to get asset types');
        return response.json();
    },

    async addAssetType(type) {
        const response = await fetch(`${API_BASE_URL}/asset-types`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(type)
        });
        if (!response.ok) throw new Error('Failed to add asset type');
        return response.json();
    },

    async updateAssetType(type) {
        const response = await fetch(`${API_BASE_URL}/asset-types/${type.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(type)
        });
        if (!response.ok) throw new Error('Failed to update asset type');
        return response.json();
    },

    async deleteAssetType(typeId) {
        const response = await fetch(`${API_BASE_URL}/asset-types/${typeId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to delete asset type');
        return response.json();
    },

    // Assets methods
    async getAssets(typeId = null) {
        const url = typeId ? 
            `${API_BASE_URL}/assets?type_id=${typeId}` : 
            `${API_BASE_URL}/assets`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to get assets');
        return response.json();
    },

    async addAsset(asset) {
        const response = await fetch(`${API_BASE_URL}/assets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(asset)
        });
        if (!response.ok) throw new Error('Failed to add asset');
        return response.json();
    },

    async updateAsset(asset) {
        const response = await fetch(`${API_BASE_URL}/assets/${asset.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(asset)
        });
        if (!response.ok) throw new Error('Failed to update asset');
        return response.json();
    },

    async deleteAsset(assetId) {
        const response = await fetch(`${API_BASE_URL}/assets/${assetId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to delete asset');
        return response.json();
    },

    async exportAssets(typeId) {
        const response = await fetch(`${API_BASE_URL}/assets/export/${typeId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to export assets');
        return response.blob();
    },

    // Theme methods
    async getThemes() {
        const response = await fetch(`${API_BASE_URL}/themes`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to get themes');
        return response.json();
    },

    async updateThemes(themes) {
        const response = await fetch(`${API_BASE_URL}/themes`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(themes)
        });
        if (!response.ok) throw new Error('Failed to update themes');
        return response.json();
    },

    // Theme management functions
    async loadTheme() {
        try {
            const theme = await apiService.getCurrentTheme();
            if (theme) {
                apiService.applyTheme(theme);
            }
        } catch (error) {
            console.error('Error loading theme:', error);
            showNotification('Error loading theme', 'error');
        }
    },

    applyTheme(theme) {
        // Remove existing theme classes
        document.body.classList.remove('light-theme', 'dark-theme', 'high-contrast-theme');
        
        // Apply new theme
        document.body.classList.add(`${theme.name}-theme`);
        
        // Apply custom colors if provided
        if (theme.colors) {
            const root = document.documentElement;
            Object.entries(theme.colors).forEach(([key, value]) => {
                root.style.setProperty(`--${key}`, value);
            });
        }
    },

    // Backup methods
    async createBackup() {
        const response = await fetch(`${API_BASE_URL}/backups`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to create backup');
        return response.json();
    },

    async restoreBackup(backupId) {
        const response = await fetch(`${API_BASE_URL}/backups/${backupId}/restore`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to restore backup');
        return response.json();
    },

    async deleteBackup(backupId) {
        const response = await fetch(`${API_BASE_URL}/backups/${backupId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to delete backup');
        return response.json();
    },

    // Notification methods
    async getNotifications() {
        const response = await fetch(`${API_BASE_URL}/notifications`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch notifications');
        return response.json();
    },

    async createNotification(title, message, type) {
        const response = await fetch(`${API_BASE_URL}/notifications`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, message, type })
        });
        if (!response.ok) throw new Error('Failed to create notification');
        return response.json();
    },

    async markNotificationAsRead(notificationId) {
        const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to mark notification as read');
        return response.json();
    },

    async deleteNotification(notificationId) {
        const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to delete notification');
        return response.json();
    },

    // Template methods
    async getTemplates() {
        const response = await fetch(`${API_BASE_URL}/templates`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch templates');
        return response.json();
    },

    async addTemplate(template) {
        const response = await fetch(`${API_BASE_URL}/templates`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(template)
        });
        if (!response.ok) throw new Error('Failed to add template');
        return response.json();
    },

    async updateTemplate(template) {
        const response = await fetch(`${API_BASE_URL}/templates/${template.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(template)
        });
        if (!response.ok) throw new Error('Failed to update template');
        return response.json();
    },

    async deleteTemplate(templateId) {
        const response = await fetch(`${API_BASE_URL}/templates/${templateId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to delete template');
        return response.json();
    },

    // Guide methods
    async getGuides() {
        const response = await fetch(`${API_BASE_URL}/guides`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch guides');
        return response.json();
    },

    async addGuide(guide) {
        const response = await fetch(`${API_BASE_URL}/guides`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(guide)
        });
        if (!response.ok) throw new Error('Failed to add guide');
        return response.json();
    },

    async updateGuide(guide) {
        const response = await fetch(`${API_BASE_URL}/guides/${guide.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(guide)
        });
        if (!response.ok) throw new Error('Failed to update guide');
        return response.json();
    },

    async deleteGuide(guideId) {
        const response = await fetch(`${API_BASE_URL}/guides/${guideId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to delete guide');
        return response.json();
    },

    // Help methods
    async getHelpArticles() {
        const response = await fetch(`${API_BASE_URL}/help`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch help articles');
        return response.json();
    },

    async searchHelpArticles(query) {
        const response = await fetch(`${API_BASE_URL}/help/search?query=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to search help articles');
        return response.json();
    },

    // Dashboard methods
    async getDashboardData() {
        const response = await fetch(`${API_BASE_URL}/dashboard`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to get dashboard data');
        return response.json();
    },

    async toggleFavorite(entryId) {
        const response = await fetch(`${API_BASE_URL}/entries/${entryId}/favorite`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to toggle favorite');
        return response.json();
    },

    async incrementViewCount(entryId) {
        const response = await fetch(`${API_BASE_URL}/entries/${entryId}/view`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to increment view count');
        return response.json();
    },

    async getEntry(entryId) {
        const response = await fetch(`${API_BASE_URL}/entries/${entryId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to get entry');
        return response.json();
    },

    // Theme management
    async updateTheme(theme) {
        const response = await fetch(`${API_BASE_URL}/themes/${theme.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(theme)
        });
        if (!response.ok) throw new Error('Failed to update theme');
        return response.json();
    },

    async addTheme(theme) {
        const response = await fetch(`${API_BASE_URL}/themes`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(theme)
        });
        if (!response.ok) throw new Error('Failed to add theme');
        return response.json();
    },

    async deleteTheme(themeId) {
        const response = await fetch(`${API_BASE_URL}/themes/${themeId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to delete theme');
        return response.json();
    },

    // Notification management
    async updateNotification(notification) {
        const response = await fetch(`${API_BASE_URL}/notifications/${notification.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(notification)
        });
        if (!response.ok) throw new Error('Failed to update notification');
        return response.json();
    },

    async addNotification(notification) {
        const response = await fetch(`${API_BASE_URL}/notifications`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(notification)
        });
        if (!response.ok) throw new Error('Failed to add notification');
        return response.json();
    },

    async deleteNotification(notificationId) {
        const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to delete notification');
        return response.json();
    },

    async getCurrentTheme() {
        const response = await fetch(`${API_BASE_URL}/themes/current`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to get current theme');
        return response.json();
    },

    async getSections() {
        const response = await fetch(`${API_BASE_URL}/sections`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to get sections');
        return response.json();
    },

    async toggleGuideDropdown(isOpen) {
        const response = await fetch(`${API_BASE_URL}/sections/toggle-guide-dropdown`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ isOpen })
        });
        if (!response.ok) throw new Error('Failed to toggle guide dropdown');
        return response.json();
    },

    async setCurrentSection(sectionId) {
        const response = await fetch(`${API_BASE_URL}/sections/set-current-section`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ sectionId })
        });
        if (!response.ok) throw new Error('Failed to set current section');
        return response.json();
    },

    async getUserState() {
        const response = await fetch(`${API_BASE_URL}/sections/get-user-state`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error('Failed to get user state');
        return response.json();
    },

    async openFile(filePath) {
        try {
            await apiService.downloadFile(filePath);
            showNotification('File opened successfully', 'success');
        } catch (error) {
            console.error('Error opening file:', error);
            showNotification('Error opening file', 'error');
        }
    }
};

async function renderSidebar() {
    const sidebarSections = document.querySelector('.sidebar-sections');
    sidebarSections.innerHTML = '<div class="loading">Loading sidebar...</div>';
    try {
        const sections = await apiService.getSections();
        let sidebarHTML = '';
        sections.forEach(section => {
            sidebarHTML += `
                <div class="sidebar-section ${section.id === currentSection ? 'active' : ''}" data-section-id="${section.id}">
                    <div class="section-header">
                        <i class="fas ${section.icon}"></i>
                        <span>${section.name}</span>
                        ${section.isGuide ? '<i class="fas fa-chevron-down dropdown-icon"></i>' : ''}
                    </div>
                    ${section.isGuide ? '<div class="section-content" style="display: none;"></div>' : ''}
                </div>
            `;
        });
        sidebarSections.innerHTML = sidebarHTML;
        
        // Add event listeners for section clicks
        document.querySelectorAll('.sidebar-section').forEach(section => {
            section.addEventListener('click', async (e) => {
                const sectionId = section.dataset.sectionId;
                const clickedSection = sections.find(s => s.id === sectionId);

                if (clickedSection.isGuide) {
                    const dropdownIcon = section.querySelector('.dropdown-icon');
                    const content = section.querySelector('.section-content');
                    const isOpen = !content.style.display || content.style.display === 'none';

                    await apiService.toggleGuideDropdown(isOpen);
                    dropdownIcon.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0)';
                    content.style.display = isOpen ? 'block' : 'none';

                    if (isOpen) {
                        await loadCategories();
                    }
                } else if (sectionId === 'assets') {
                    currentSection = sectionId;
                    await apiService.setCurrentSection(sectionId);
                    assetManagerView = 'list'; // Always start at the types list
                    renderAssetManagerPage();
                    document.querySelectorAll('.sidebar-section').forEach(s => {
                        s.classList.toggle('active', s.dataset.sectionId === sectionId);
                    });
                    return;
                } else if (sectionId === 'asset-manager') {
                    currentSection = sectionId;
                    await apiService.setCurrentSection(sectionId);
                    renderAssetManagerPage();
                    document.querySelectorAll('.sidebar-section').forEach(s => {
                        s.classList.toggle('active', s.dataset.sectionId === sectionId);
                    });
                    return;
                }

                await apiService.setCurrentSection(sectionId);
                currentSection = sectionId;

                // Update active states
                document.querySelectorAll('.sidebar-section').forEach(s => {
                    s.classList.toggle('active', s.dataset.sectionId === sectionId);
                });
            });
        });
        
        // Load initial state
        const userState = await apiService.getUserState();
        if (userState.currentSection) {
            currentSection = userState.currentSection;
            document.querySelectorAll('.sidebar-section').forEach(section => {
                section.classList.toggle('active', section.dataset.sectionId === currentSection);
            });
        }
        
        if (userState.guideDropdownOpen) {
            const guideSection = document.querySelector('[data-section-id="guide"]');
            if (guideSection) {
                const dropdownIcon = guideSection.querySelector('.dropdown-icon');
                const content = guideSection.querySelector('.section-content');
                dropdownIcon.style.transform = 'rotate(180deg)';
                content.style.display = 'block';
                await loadCategories();
            }
        }
        // Reveal sidebar after rendering
        document.querySelector('.sidebar')?.classList.remove('sidebar--loading');
    } catch (error) {
        console.error('Error rendering sidebar:', error);
        showNotification('Error loading sidebar sections', 'error');
    }
}

async function renderSection(sectionId) {
    try {
        const categories = await apiService.getCategories();
        const section = categories.find(c => c.id === sectionId);
        if (!section) return;

        const entries = await apiService.getEntries(sectionId);
        renderEntries(entries);
    } catch (error) {
        console.error('Error rendering section:', error);
        showNotification('Error loading section. Please try again.', 'error');
    }
}

// Placeholder renderers for new sections
async function renderTemplatesPage() {
    try {
        const templates = await apiService.getTemplates();
        
        entriesContainer.innerHTML = `
            <div class="templates-page">
                <div class="templates-header">
                    <h2><i class="fas fa-file-alt"></i> Templates</h2>
                    <button class="add-template-btn">
                        <i class="fas fa-plus"></i> New Template
                    </button>
                </div>
                <div class="templates-grid">
                    ${templates.map(template => `
                        <div class="template-card" data-template-id="${template.id}">
                            <div class="template-header">
                                <h3>${template.name}</h3>
                                <div class="template-actions">
                                    <button class="edit-template" title="Edit">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="delete-template" title="Delete">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                            <p class="template-description">${template.description || ''}</p>
                            <div class="template-tags">
                                ${template.tags ? template.tags.split(',').map(tag => 
                                    `<span class="tag">${tag.trim()}</span>`
                                ).join('') : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Add event listeners
        const addTemplateBtn = entriesContainer.querySelector('.add-template-btn');
        addTemplateBtn.addEventListener('click', () => showTemplateModal());

        entriesContainer.querySelectorAll('.edit-template').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const templateId = e.target.closest('.template-card').dataset.templateId;
                const template = templates.find(t => t.id === templateId);
                showTemplateModal(template);
            });
        });

        entriesContainer.querySelectorAll('.delete-template').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const templateId = e.target.closest('.template-card').dataset.templateId;
                if (confirm('Are you sure you want to delete this template?')) {
                    try {
                        await apiService.deleteTemplate(templateId);
                        renderTemplatesPage();
                        showNotification('Template deleted successfully');
                    } catch (error) {
                        console.error('Error deleting template:', error);
                        showNotification('Error deleting template', 'error');
                    }
                }
            });
        });
    } catch (error) {
        console.error('Error rendering templates page:', error);
        showNotification('Error loading templates', 'error');
    }
}

async function renderAssetManagerPage() {
  console.log('renderAssetManagerPage called with view:', assetManagerView);
  if (assetManagerView === 'list') {
    console.log('Rendering asset types cards page');
    await renderAssetTypesCardsPage();
  } else if (assetManagerView === 'type' && selectedAssetTypeId) {
    console.log('Rendering asset type spreadsheet page for type:', selectedAssetTypeId);
    await renderAssetTypeSpreadsheetPage(selectedAssetTypeId);
  }
}

async function renderHelpPage() {
    try {
        const articles = await apiService.getHelpArticles();
        
        entriesContainer.innerHTML = `
            <div class="help-page">
                <div class="help-header">
                    <h2><i class="fas fa-question-circle"></i> Help</h2>
                    <div class="help-search">
                        <i class="fas fa-search"></i>
                        <input type="text" placeholder="Search help articles..." class="help-search-input">
                    </div>
                </div>
                <div class="help-categories">
                    ${Object.entries(groupBy(articles, 'category')).map(([category, categoryArticles]) => `
                        <div class="help-category">
                            <h3>${category}</h3>
                            <div class="help-articles">
                                ${categoryArticles.map(article => `
                                    <div class="help-article" data-article-id="${article.id}">
                                        <h4>${article.title}</h4>
                                        <div class="help-article-content">${article.content}</div>
                                        <div class="help-article-tags">
                                            ${article.tags ? article.tags.split(',').map(tag => 
                                                `<span class="tag">${tag.trim()}</span>`
                                            ).join('') : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Add search functionality
        const searchInput = entriesContainer.querySelector('.help-search-input');
        searchInput.addEventListener('input', debounce(async (e) => {
            const query = e.target.value.trim();
            if (query) {
                const results = await apiService.searchHelpArticles(query);
                renderHelpSearchResults(results);
            } else {
                renderHelpPage();
            }
        }, 300));
    } catch (error) {
        console.error('Error rendering help page:', error);
        showNotification('Error loading help articles', 'error');
    }
}

function renderHelpSearchResults(articles) {
    const resultsContainer = entriesContainer.querySelector('.help-categories');
    if (articles.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <p>No help articles found matching your search.</p>
            </div>
        `;
        return;
    }

    resultsContainer.innerHTML = `
        <div class="help-category">
            <h3>Search Results</h3>
            <div class="help-articles">
                ${articles.map(article => `
                    <div class="help-article" data-article-id="${article.id}">
                        <h4>${article.title}</h4>
                        <div class="help-article-content">${article.content}</div>
                        <div class="help-article-tags">
                            ${article.tags ? article.tags.split(',').map(tag => 
                                `<span class="tag">${tag.trim()}</span>`
                            ).join('') : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Utility function for grouping arrays
function groupBy(array, key) {
    return array.reduce((result, item) => {
        (result[item[key]] = result[item[key]] || []).push(item);
        return result;
    }, {});
}

// Initialize the app
async function initApp() {
    try {
        // Check authentication
        if (!authToken) {
            window.location.href = '/login.html';
            return;
        }
        
        // Load initial data
        await loadCategories();
        config = await apiService.getConfig();
        updateDeviceInfo();
        renderSidebar(); // Load sidebar as early as possible
        await loadNotifications();
        await loadTheme();
        setupEventListeners();
        initializeShortcuts();
        renderDashboard();
        restoreWindowState();
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Error initializing app', 'error');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Initialize modal and its event listeners
function initializeModal() {
    // Ensure modal starts hidden
    entryModal.style.display = 'none';
    
    // Set up modal close handlers
    const closeModal = () => {
        entryModal.style.display = 'none';
        entryForm.reset();
        forceClearOverlaysAndPointerEvents();
    };
    
    // Add event listeners for modal controls
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Close modal when clicking outside
    entryModal.addEventListener('click', (e) => {
        if (e.target === entryModal) {
            closeModal();
        }
    });
    
    // Prevent modal close when clicking modal content
    entryModal.querySelector('.modal-content').addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Add escape key handler
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && entryModal.style.display === 'block') {
            closeModal();
        }
    });
}

// Update device info in UI
function updateDeviceInfo() {
    const deviceId = config.deviceId.slice(0, 8); // Show only first 8 characters
    portableIndicator.textContent = `Portable Mode (Device: ${deviceId})`;
}

// Check if merge notification should be shown
function checkMergeNotifications() {
    if (!config.settings.mergeNotifications) return;

    const lastMerged = config.lastMerged ? new Date(config.lastMerged) : null;
    if (!lastMerged || daysSince(lastMerged) >= config.settings.mergeNotificationDays) {
        showMergeNotification();
    }
}

// Calculate days since a date
function daysSince(date) {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Calculate time since a date
function timeSince(date) {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return `${diffDays}d`;
    } else if (diffHours > 0) {
        return `${diffHours}h`;
    } else if (diffMinutes > 0) {
        return `${diffMinutes}m`;
    } else {
        return 'just now';
    }
}

// Show merge notification
function showMergeNotification() {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <i class="fas fa-sync-alt"></i>
        <span>It's been a while since your last merge. Consider exporting your changes to share with the team.</span>
        <button class="close-notification"><i class="fas fa-times"></i></button>
    `;
    document.body.appendChild(notification);

    // Handle close button
    notification.querySelector('.close-notification').addEventListener('click', () => {
        notification.remove();
    });
}

// Set up event listeners
function setupEventListeners() {
    // Export/Import
    document.getElementById('export-btn')?.addEventListener('click', handleExport);
    document.getElementById('import-btn')?.addEventListener('change', handleImport);
    
    // Category settings
    document.getElementById('category-settings-btn')?.addEventListener('click', handleCategorySettings);
}

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', setupEventListeners);

// Render categories in the sidebar
function renderCategories(categories) {
    const categoryListDiv = document.querySelector('.category-list');
    if (!categoryListDiv) return;

    try {
        categoryListDiv.innerHTML = `
            <div class="category-item${!currentCategory ? ' active' : ''}" data-id="dashboard">
                <h3><i class="fas fa-home"></i> Dashboard</h3>
                <span class="entry-count">Home</span>
            </div>
            ${categories.map(category => `
                <div class="category-item${currentCategory === category.id ? ' active' : ''}" 
                     data-id="${category.id}" 
                     style="--category-color: ${category.color || '#3498db'}">
                    <h3>
                        <i class="fas fa-${category.icon || 'folder'}"></i> 
                        ${category.name}
                    </h3>
                    <span class="entry-count">${category.entryCount || 0} entries</span>
                </div>
            `).join('')}
        `;

        // Add click handlers for category items
        categoryListDiv.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                const categoryId = item.dataset.id;
                
                try {
                    if (categoryId === 'dashboard') {
                        currentCategory = null;
                        currentSection = 'dashboard';
                        await renderDashboard();
                    } else {
                        currentCategory = categoryId;
                        currentSection = 'entries';
                        await loadEntries(categoryId);
                    }
                    
                    // Update active states
                    document.querySelectorAll('.category-item').forEach(i => 
                        i.classList.remove('active')
                    );
                    item.classList.add('active');
                    
                    // Update sidebar
                    renderSidebar();
                } catch (error) {
                    console.error('Error handling category click:', error);
                    showNotification('Error loading category content. Please try again.', 'error');
                }
            });
        });
    } catch (error) {
        console.error('Error rendering categories:', error);
        showNotification('Error displaying categories. Please try again.', 'error');
    }
}

// Load entries for a category
async function loadEntries(categoryId) {
    try {
        console.log('Loading entries for category:', categoryId);
        entries = await apiService.getEntries(categoryId);
        console.log('Entries loaded:', entries);
        
        // Update the entries container
        renderEntries(entries);
        
        // Update the category title
        const category = categories.find(c => c.id === categoryId);
        if (category) {
            document.querySelector('.content-header h2').textContent = category.name;
        }
        
        // Show the add entry button
        showAddEntryButton();
    } catch (error) {
        console.error('Error loading entries:', error);
        showNotification('Error loading entries. Please try again.', 'error');
    }
}

// Helper function to render star ratings
function renderStars(entryId, currentRating = null) {
    let stars = '<div class="rating-stars" data-entry-id="' + entryId + '">';
    for (let i = 1; i <= 5; i++) {
        stars += `<span class="star ${i <= (currentRating || 0) ? 'active' : ''}" data-rating="${i}">★</span>`;
    }
    stars += '</div>';
    return stars;
}

// Handle star rating click
async function handleStarClick(star) {
    const entryId = star.parentElement.dataset.entryId;
    const rating = parseInt(star.dataset.rating);
    
    try {
        await apiService.addRating({
            entry_id: entryId,
            rating: rating
        });
        
        // Update the stars visually
        const stars = star.parentElement.querySelectorAll('.star');
        stars.forEach((s, index) => {
            s.classList.toggle('active', index < rating);
        });
        
        showNotification('Rating saved successfully', 'success');
    } catch (error) {
        console.error('Error saving rating:', error);
        showNotification('Error saving rating', 'error');
    }
}

// Render entries in the main content area
function renderEntries(entriesToRender = entries) {
    const entriesContainer = document.querySelector('.entries-container');
    if (!entriesContainer) return;

    // Clear the container
    entriesContainer.innerHTML = '';

    // Create a wrapper for sort controls and grid
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';
    entriesContainer.appendChild(contentWrapper);

    // Add sort controls if there are entries to sort
    if (entriesToRender && entriesToRender.length > 0) {
        const sortControls = document.createElement('div');
        sortControls.className = 'sort-controls';
        sortControls.innerHTML = `
            <span class="sort-label">Sort by:</span>
            <select class="sort-select" id="entrySortSelect">
                <option value="title">Title (A-Z)</option>
                <option value="titleDesc">Title (Z-A)</option>
                <option value="dateCreated">Date Created (Newest)</option>
                <option value="dateCreatedAsc">Date Created (Oldest)</option>
                <option value="dateModified">Last Modified (Newest)</option>
                <option value="dateModifiedAsc">Last Modified (Oldest)</option>
                <option value="rating">Rating (Highest)</option>
                <option value="ratingAsc">Rating (Lowest)</option>
            </select>
        `;
        contentWrapper.appendChild(sortControls);
    }

    // Create a container for the entries grid
    const entriesGrid = document.createElement('div');
    entriesGrid.className = 'entries-grid';
    contentWrapper.appendChild(entriesGrid);

    // Sort entries before paginating
    const sortedEntries = sortEntries(entriesToRender, currentCategorySort);

    // Calculate pagination
    const totalPages = Math.ceil(sortedEntries.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, sortedEntries.length);
    const paginatedEntries = sortedEntries.slice(startIndex, endIndex);

    // Render paginated entries
    if (paginatedEntries.length === 0) {
        entriesGrid.innerHTML = `
            <div class="no-entries">
                <i class="fas fa-inbox"></i>
                <p>No entries found in this category.</p>
                <button class="add-entry-btn">
                    <i class="fas fa-plus"></i>
                    Add Entry
                </button>
            </div>
        `;
        // Attach event listener to Add Entry button
        const addEntryBtn = entriesGrid.querySelector('.add-entry-btn');
        if (addEntryBtn) {
            addEntryBtn.addEventListener('click', () => showModal());
        }
    } else {
        paginatedEntries.forEach(entry => {
            const entryElement = createEntryElement(entry);
            entriesGrid.appendChild(entryElement);
        });
    }

    // Add pagination controls if there are multiple pages
    if (totalPages > 1) {
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-container';
        // Remove inline styles so CSS can control layout

        const pagination = new Pagination({
            container: paginationContainer,
            totalItems: sortedEntries.length,
            currentPage: currentPage,
            pageSize: itemsPerPage,
            onPageChange: (page) => {
                currentPage = page;
                renderEntries(entriesToRender);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });

        // Append pagination as a grid item inside entriesGrid
        entriesGrid.appendChild(paginationContainer);
    }

    // Set the sort dropdown value and add change handler
    const entrySortSelect = document.getElementById('entrySortSelect');
    if (entrySortSelect) {
        entrySortSelect.value = currentCategorySort;
        entrySortSelect.addEventListener('change', () => {
            currentCategorySort = entrySortSelect.value;
            currentPage = 1;
            renderEntries(entriesToRender);
        });
    }

    // Add event listeners
    // setupEntryEventListeners();

    updateTopRightButton('categories');
}

// Function to sort entries based on selected criteria
function sortEntries(entries, sortBy) {
    if (!Array.isArray(entries)) return [];
    
    return [...entries].sort((a, b) => {
        switch (sortBy) {
            case 'title':
                return a.title.localeCompare(b.title);
            case 'titleDesc':
                return b.title.localeCompare(a.title);
            case 'dateCreated':
                return new Date(b.created_at) - new Date(a.created_at);
            case 'dateCreatedAsc':
                return new Date(a.created_at) - new Date(b.created_at);
            case 'dateModified':
                return new Date(b.updated_at) - new Date(a.updated_at);
            case 'dateModifiedAsc':
                return new Date(a.updated_at) - new Date(b.updated_at);
            case 'rating':
                return (b.rating || 0) - (a.rating || 0);
            case 'ratingAsc':
                return (a.rating || 0) - (b.rating || 0);
            default:
                return a.title.localeCompare(b.title);
        }
    });
}

// Function to render just the entries list (without recreating sort controls)
function renderEntriesList(sortedEntries) {
    const entriesGrid = document.querySelector('.entries-grid');
    if (!entriesGrid) return;

    entriesGrid.innerHTML = '';

    if (!sortedEntries || sortedEntries.length === 0) {
        entriesGrid.innerHTML = `
            <div class="no-entries">
                <i class="fas fa-inbox"></i>
                <p>No entries found</p>
                <button class="add-entry-btn" onclick="showModal()">
                    <i class="fas fa-plus"></i>
                    Add Entry
                </button>
            </div>
        `;
        return;
    }

    sortedEntries.forEach(entry => {
        const entryElement = createEntryElement(entry);
        entriesGrid.appendChild(entryElement);
    });
}

// Search functionality
async function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    const searchClearBtn = document.querySelector('.search-clear-btn');
    searchClearBtn.classList.toggle('visible', searchTerm.length > 0);
    
    if (!searchTerm) {
        // If search is cleared, return to normal view
        if (!currentCategory) {
            await renderDashboard();
        } else {
            await loadEntries(currentCategory);
        }
        return;
    }

    try {
        // Get all categories for reference
        const categories = await apiService.getCategories();
        
        // Search across all entries
        const allEntries = [];
        for (const category of categories) {
            const categoryEntries = await apiService.getEntries(category.id);
            allEntries.push(...categoryEntries.map(entry => ({
                ...entry,
                category_name: category.name
            })));
        }

        // Perform search
        const searchResults = allEntries.filter(entry => {
            const searchableFields = [
                entry.title,
                entry.description,
                entry.wisdom,
                entry.tags,
                entry.category_name,
                entry.files?.map(f => f.name).join(' ') || ''
            ].map(field => (field || '').toLowerCase());

            return searchableFields.some(field => field.includes(searchTerm));
        });

        // Group results by category
        const groupedResults = {};
        searchResults.forEach(entry => {
            const categoryName = entry.category_name || 'Uncategorized';
            if (!groupedResults[categoryName]) {
                groupedResults[categoryName] = [];
            }
            groupedResults[categoryName].push(entry);
        });

        // Render search results
        const container = document.querySelector('.entries-container');
        container.innerHTML = `
            <div class="search-results">
                <h2><i class="fas fa-search"></i> Search Results for "${searchTerm}"</h2>
                ${Object.keys(groupedResults).length > 0 ? `
                    ${Object.entries(groupedResults).map(([categoryName, entries]) => `
                        <div class="search-category-group">
                            <h3><i class="fas fa-folder"></i> ${categoryName} (${entries.length})</h3>
                            <div class="search-entries-grid">
                                ${entries.map(entry => {
                                    const highlightedTitle = entry.title.replace(
                                        new RegExp(searchTerm, 'gi'),
                                        match => `<mark>${match}</mark>`
                                    );
                                    const highlightedDesc = entry.description?.replace(
                                        new RegExp(searchTerm, 'gi'),
                                        match => `<mark>${match}</mark>`
                                    );

                                    return `
                                        <div class="search-entry" data-entry-id="${entry.id}" data-category-id="${entry.category_id}">
                                            <div class="search-entry-header">
                                                <h4>${highlightedTitle}</h4>
                                                ${entry.description ? `
                                                    <p>${highlightedDesc}</p>
                                                ` : ''}
                                            </div>
                                            <div class="search-entry-meta">
                                                ${entry.tags ? `
                                                    <div class="search-entry-tags">
                                                        ${entry.tags.split(',').map(tag => `
                                                            <span class="tag">${tag.trim()}</span>
                                                        `).join('')}
                                                    </div>
                                                ` : ''}
                                                <div class="search-entry-info">
                                                    <span><i class="fas fa-calendar"></i> ${new Date(entry.updated_at).toLocaleDateString()}</span>
                                                    ${entry.files?.length ? `
                                                        <span><i class="fas fa-paperclip"></i> ${entry.files.length} files</span>
                                                    ` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `).join('')}
                ` : '<p class="no-results">No matching entries found</p>'}
            </div>
        `;

        // Add click handlers for search results
        container.querySelectorAll('.search-entry').forEach(result => {
            result.addEventListener('click', async () => {
                const categoryId = result.dataset.categoryId;
                const entryId = result.dataset.entryId;
                
                try {
                    // Get the entry data from the API
                    const entryData = await apiService.getEntry(entryId);
                    if (!entryData) {
                        throw new Error('Could not find entry data');
                    }

                    // Show the modal with the entry data
                    showModal(entryData);
                } catch (error) {
                    console.error('Error opening edit modal:', error);
                    showNotification('Error opening edit modal', 'error');
                }
            });
        });

    } catch (error) {
        console.error('Error performing search:', error);
        showNotification('Error performing search', 'error');
    }
}

// Add event listener for search
document.querySelector('.search-container input')?.addEventListener('input', debounce(handleSearch, 300));

// Populate category dropdown
async function populateCategoryDropdown() {
    try {
        const categorySelect = document.getElementById('category');
        const categories = await apiService.getCategories();
        
        // Clear existing options
        categorySelect.innerHTML = '';
        
        // Add a placeholder option
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- Select a Category --';
        placeholder.disabled = true;
        placeholder.selected = true;
        categorySelect.appendChild(placeholder);
        
        // Sort categories by name
        const sortedCategories = categories.sort((a, b) => a.name.localeCompare(b.name));
        
        // Add unique categories to dropdown
        const addedNames = new Set();
        sortedCategories.forEach(category => {
            if (!addedNames.has(category.name)) {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categorySelect.appendChild(option);
                addedNames.add(category.name);
            }
        });
        
        // Set the current category as selected if available
        if (currentCategory) {
            categorySelect.value = currentCategory;
        }
    } catch (error) {
        console.error('Error populating category dropdown:', error);
    }
}

// Show modal for adding/editing entries
function showModal(entry = null) {
    console.log('Opening modal with entry:', entry);
    
    // Close asset type modal if open
    const assetTypeModal = document.getElementById('asset-type-modal');
    if (assetTypeModal) assetTypeModal.remove();
    
    // Reset form and clear any existing data
    entryForm.reset();
    pendingFiles = [];
    
    // Update modal title and add delete button if editing
    const modalTitle = entryModal.querySelector('h2');
    modalTitle.textContent = entry ? 'Edit Entry' : 'Add New Entry';
    
    // Update form actions
    const formActions = entryModal.querySelector('.form-actions');
    formActions.innerHTML = `
        <button type="submit" class="btn btn-primary">Save</button>
        <button type="button" class="btn btn-secondary cancel-btn">Cancel</button>
        ${entry ? `
            <button type="button" class="btn btn-danger delete-btn">
                <i class="fas fa-trash"></i>
                Delete Entry
            </button>
        ` : ''}
    `;
    
    // Add event listeners for the new buttons
    formActions.querySelector('.cancel-btn').addEventListener('click', () => {
        entryModal.style.display = 'none';
        entryForm.reset();
    });
    
    if (entry) {
        const deleteBtn = formActions.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                if (deleteBtn.disabled || !entry.id) {
                    return;
                }

                if (confirm('Are you sure you want to delete this entry? This action cannot be undone.')) {
                    try {
                        // Disable the delete button immediately
                        deleteBtn.disabled = true;
                        
                        // Close modal first
                        entryModal.style.display = 'none';
                        entryForm.reset();
                        
                        // Perform deletion
                        await apiService.deleteEntry(entry.id);
                        
                        // Reset window and input state
                        await resetWindowAndInputState();
                        setupEventListeners();
                        
                        // Remove entry from UI
                        const entryElement = document.querySelector(`.entry[data-entry-id="${entry.id}"]`);
                        if (entryElement && document.body.contains(entryElement)) {
                            entryElement.remove();
                        }
                        
                        // Refresh the view
                        if (currentCategory) {
                            entries = await apiService.getEntries(currentCategory);
                            await renderEntries(entries);
                        } else {
                            await renderDashboard();
                        }
                        
                        // Show success notification
                        showNotification('Entry deleted successfully', 'success');
                        
                        // Refresh categories
                        await refreshCategories();
                        
                        // Focus search input after everything is done
                        setTimeout(() => {
                            const searchInput = document.querySelector('#search');
                            if (searchInput) {
                                const newSearchInput = searchInput.cloneNode(true);
                                newSearchInput.value = searchInput.value;
                                searchInput.parentNode.replaceChild(newSearchInput, searchInput);
                                newSearchInput.focus();
                            }
                        }, 100);
                        
                    } catch (error) {
                        console.error('Error deleting entry:', error);
                        showNotification('Failed to delete entry', 'error');
                        deleteBtn.disabled = false;
                        
                        // Try to reset window state even on error
                        await resetWindowAndInputState();
                        setupEventListeners();
                    }
                }
            });
        }
    }
    
    // Show modal
    entryModal.style.display = 'block';
    
    // Reset focus state
    document.documentElement.style.pointerEvents = 'auto';
    document.body.style.pointerEvents = 'auto';
    
    // Populate category dropdown and then set form values
    populateCategoryDropdown().then(() => {
        if (entry) {
            currentEntryId = entry.id;
            currentFiles = entry.files || [];
            console.log('Title:', entry.title);
            document.getElementById('title').value = entry.title || '';
            console.log('Description:', entry.description);
            document.getElementById('description').value = entry.description || '';
            console.log('Wisdom:', entry.wisdom);
            document.getElementById('wisdom').value = entry.wisdom || '';
            console.log('Tags:', entry.tags);
            document.getElementById('tags').value = entry.tags || '';
            console.log('Category ID:', entry.category_id || entry.categoryId);
            if (entry.category_id) {
                document.getElementById('category').value = entry.category_id;
            } else if (entry.categoryId) {
                document.getElementById('category').value = entry.categoryId;
            }
        } else {
            currentEntryId = null;
            currentFiles = [];
            if (currentCategory) {
                document.getElementById('category').value = currentCategory;
            }
        }
        updateFileDisplay();
        const titleField = document.getElementById('title');
        if (titleField) {
            titleField.focus();
        }
    });
}

// Handle file input changes
document.getElementById('file').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    
    for (const file of files) {
        try {
            // Save the file and get the new path
            const result = await apiService.save_file({
                name: file.name,
                path: file.path || file.name
            });
            
            pendingFiles.push({
                name: file.name,
                path: result.filePath
            });
            
            // Update the file display
            updateFileDisplay();
        } catch (error) {
            console.error('Error saving file:', error);
            showNotification('Error saving file', 'error');
        }
    }
    
    // Clear the file input
    e.target.value = '';
});

// Update the file display in the modal
function updateFileDisplay() {
    const fileInfo = document.createElement('div');
    fileInfo.className = 'current-file-info';
    
    const allFiles = [...currentFiles, ...pendingFiles];
    
    if (allFiles.length > 0) {
        fileInfo.innerHTML = `
            <p>Attached files:</p>
            <ul class="file-list">
                ${allFiles.map(file => `
                    <li>
                        <span>${file.name || file.path.split('/').pop()}</span>
                        <button type="button" class="remove-file-btn" data-path="${file.path}">
                            <i class="fas fa-times"></i>
                        </button>
                    </li>
                `).join('')}
            </ul>
        `;
        
        // Add event listeners for remove file buttons
        fileInfo.querySelectorAll('.remove-file-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const path = btn.dataset.path;
                // Remove from either currentFiles or pendingFiles
                currentFiles = currentFiles.filter(file => file.path !== path);
                pendingFiles = pendingFiles.filter(file => file.path !== path);
                updateFileDisplay();
            });
        });
    } else {
        fileInfo.innerHTML = '<p>No files attached</p>';
    }
    
    // Remove existing file info if present
    const existingFileInfo = entryModal.querySelector('.current-file-info');
    if (existingFileInfo) {
        existingFileInfo.remove();
    }
    
    // Insert new file info before form actions
    const formActions = entryModal.querySelector('.form-actions');
    entryModal.querySelector('form').insertBefore(fileInfo, formActions);
}

// Handle export
async function handleExport() {
    try {
        const blob = await apiService.exportData();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${new Date().toISOString()}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showNotification('Data exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        showNotification('Error exporting data', 'error');
    }
}

async function handleImport(event) {
    try {
        const file = event.target.files[0];
        if (!file) return;
        
        await apiService.importData(file);
        showNotification('Data imported successfully', 'success');
        
        // Refresh the UI
        await loadCategories();
        await loadEntries(currentCategory);
    } catch (error) {
        console.error('Error importing data:', error);
        showNotification('Error importing data', 'error');
    }
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add getCategoryName function
async function getCategoryName(categoryId) {
    try {
        const categories = await apiService.getCategories();
        const category = categories.find(cat => cat.id === categoryId);
        return category ? category.name : 'Unknown Category';
    } catch (error) {
        console.error('Error getting category name:', error);
        return 'Unknown Category';
    }
}

// Add showNotification function if it doesn't exist
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
        <span>${message}</span>
        <button class="close-notification"><i class="fas fa-times"></i></button>
    `;
    document.body.appendChild(notification);

    // Add close button handler
    const closeBtn = notification.querySelector('.close-notification');
    closeBtn.addEventListener('click', () => notification.remove());

    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Add a function to refresh categories
async function refreshCategories() {
    try {
        const updatedCategories = await apiService.getCategories();
        categories = updatedCategories;
        renderCategories(categories);
    } catch (error) {
        console.error('Error refreshing categories:', error);
        showNotification('Error refreshing categories', 'error');
    }
}

// Add dashboard rendering function
async function renderDashboard() {
    try {
        const dashboardData = await apiService.getDashboardData();
        
        // Update statistics with null checks
        if (dashboardData) {
            const totalEntriesElem = document.getElementById('total-entries');
            if (totalEntriesElem) totalEntriesElem.textContent = dashboardData.total_entries || '0';
            const totalCategoriesElem = document.getElementById('total-categories');
            if (totalCategoriesElem) totalCategoriesElem.textContent = dashboardData.total_categories || '0';
            const totalFilesElem = document.getElementById('total-files');
            if (totalFilesElem) totalFilesElem.textContent = dashboardData.total_files || '0';
            const totalViewsElem = document.getElementById('total-views');
            if (totalViewsElem) totalViewsElem.textContent = dashboardData.total_views || '0';
            
            // Render recent entries
            const recentEntriesContainer = document.querySelector('.recent-entries');
            if (recentEntriesContainer && dashboardData.recent_entries) {
                recentEntriesContainer.innerHTML = dashboardData.recent_entries.map(entry => `
                    <div class="recent-entry" data-entry-id="${entry.id || ''}">
                        <h4>${entry.title || 'Untitled'}</h4>
                        <p>${entry.description || ''}</p>
                        <div class="entry-meta">
                            <span><i class="fas fa-folder"></i> ${entry.category_name || 'Uncategorized'}</span>
                            <span><i class="fas fa-calendar"></i> ${entry.updated_at ? timeSince(entry.updated_at) : 'Recently'}</span>
                        </div>
                    </div>
                `).join('');
                
                // Add click handlers
                recentEntriesContainer.querySelectorAll('.recent-entry').forEach(entry => {
                    const entryId = entry.dataset.entryId;
                    if (entryId) {
                        entry.addEventListener('click', async () => {
                            try {
                                const entryData = await apiService.getEntry(entryId);
                                if (entryData) {
                                    showModal(entryData);
                                }
                            } catch (error) {
                                console.error('Error loading entry:', error);
                                showNotification('Error loading entry', 'error');
                            }
                        });
                    }
                });
            }
            
            // Render popular categories
            const popularCategoriesContainer = document.querySelector('.popular-categories');
            if (popularCategoriesContainer && dashboardData.popular_categories) {
                popularCategoriesContainer.innerHTML = dashboardData.popular_categories.map(category => `
                    <div class="popular-category" data-category-id="${category.id || ''}">
                        <h4>${category.name || 'Unnamed Category'}</h4>
                        <div class="category-stats">
                            <span><i class="fas fa-file"></i> ${category.entry_count || 0} entries</span>
                            <span><i class="fas fa-eye"></i> ${category.view_count || 0} views</span>
                        </div>
                    </div>
                `).join('');
                
                // Add click handlers
                popularCategoriesContainer.querySelectorAll('.popular-category').forEach(category => {
                    const categoryId = category.dataset.categoryId;
                    if (categoryId) {
                        category.addEventListener('click', async () => {
                            try {
                                currentCategory = categoryId;
                                await loadEntries(currentCategory);
                            } catch (error) {
                                console.error('Error loading category:', error);
                                showNotification('Error loading category', 'error');
                            }
                        });
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error rendering dashboard:', error);
        showNotification('Error rendering dashboard', 'error');
    }
}

// Render dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', renderDashboard);

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check authentication
        if (!authToken) {
            window.location.href = '/login.html';
            return;
        }

        // Load initial data
        await loadCategories();
        config = await apiService.getConfig();
        updateDeviceInfo();
        renderSidebar(); // Load sidebar as early as possible
        await loadNotifications();
        await loadTheme();
        setupEventListeners();
        initializeShortcuts();
        renderDashboard();
        restoreWindowState();

        // Default: open Guide and select first category if needed
        if (guideDropdownOpen) {
            const categories = await apiService.getCategories();
            if (categories.length > 0) {
                currentCategory = categories[0].id;
                renderSidebar();
                await loadEntries(currentCategory);
            }
        }
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Error initializing application', 'error');
    }
});

function showCategoryModal(categoryToEdit = null) {
    const modal = document.getElementById('categoryModal');
    const form = document.getElementById('categoryForm');
    const title = modal.querySelector('.modal-title');
    
    // Clear previous form
    form.innerHTML = `
        <div class="form-group">
            <label for="categoryName">Category Name:</label>
            <input type="text" id="categoryName" name="categoryName" class="form-control" required>
        </div>
        <div class="form-group">
            <label for="categoryColor">Color:</label>
            <input type="color" id="categoryColor" name="color" class="form-control" value="#3498db">
        </div>
        <div class="form-group">
            <label for="categoryIcon">Icon:</label>
            <select id="categoryIcon" name="icon" class="form-control">
                <option value="folder">Folder</option>
                <option value="star">Star</option>
                <option value="heart">Heart</option>
                <option value="bookmark">Bookmark</option>
                <option value="file">File</option>
                <option value="tag">Tag</option>
                <option value="flag">Flag</option>
            </select>
        </div>
        <input type="hidden" id="categoryId" name="categoryId">
        <div class="button-group">
            <button type="submit" class="btn btn-primary">Save Category</button>
            <button type="button" class="btn btn-secondary" onclick="hideCategoryModal()">Cancel</button>
            ${categoryToEdit ? '<button type="button" class="btn btn-danger" onclick="deleteCategory()">Delete</button>' : ''}
        </div>
    `;

    // If editing existing category, populate form
    if (categoryToEdit) {
        title.textContent = 'Edit Category';
        form.categoryName.value = categoryToEdit.name;
        form.categoryId.value = categoryToEdit.id;
        form.color.value = categoryToEdit.color || '#3498db';
        form.icon.value = categoryToEdit.icon || 'folder';
    } else {
        title.textContent = 'New Category';
    }

    modal.style.display = 'block';
}

async function handleCategorySubmit(e) {
    e.preventDefault();
    const categoryData = {
        name: document.getElementById('categoryName').value,
        description: document.getElementById('categoryDescription').value
    };
    
    try {
        if (editingCategory) {
            await apiService.updateCategory({ ...categoryData, id: editingCategory.id });
            showNotification('Category updated successfully', 'success');
        } else {
            await apiService.addCategory(categoryData);
            showNotification('Category added successfully', 'success');
        }
        await refreshCategories();
        hideCategoryModal();
    } catch (error) {
        console.error('Error saving category:', error);
        showNotification('Error saving category', 'error');
    }
}

async function deleteCategory() {
    if (!selectedCategoryId) return;
    
    try {
        await apiService.deleteCategory(selectedCategoryId);
        await loadCategories();
        hideCategoryModal();
        showNotification('Category deleted successfully!');
    } catch (error) {
        console.error('Error deleting category:', error);
        showNotification('Error deleting category. Please try again.', 'error');
    }
}

async function hideCategoryModal() {
    const modal = document.getElementById('categoryModal');
    modal.style.display = 'none';
}

async function loadCategories() {
    try {
        categories = await apiService.getCategories();
        updateCategorySelects();
        renderCategories(categories);
    } catch (error) {
        console.error('Error loading categories:', error);
        categories = [];
        showNotification('Error loading categories. Please try again.', 'error');
    }
}

function updateCategorySelects() {
    const categorySelects = document.querySelectorAll('select.category-select');
    categorySelects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = `
            <option value="">Select a category</option>
            ${categories.map(category => `
                <option value="${category.id}" ${currentValue === category.id ? 'selected' : ''}>
                    ${category.name}
                </option>
            `).join('')}
        `;
    });
}

// Event Listeners
document.getElementById('categoryForm')?.addEventListener('submit', handleCategorySubmit);
document.querySelector('#categoryModal .close')?.addEventListener('click', hideCategoryModal);
document.getElementById('category-settings-btn')?.addEventListener('click', showCategorySettingsModal);

// Initialize categories on load
loadCategories();

function selectCategory(category) {
    selectedCategoryId = category.id;
    // Update form with category data
    const form = document.getElementById('categoryForm');
    if (form) {
        form.categoryName.value = category.name;
        form.categoryId.value = category.id;
        form.color.value = category.color || '#3498db';
        form.icon.value = category.icon || 'folder';
    }
    
    // Update UI state
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.id === category.id);
    });
}

// Asset management functions
async function handleAssetTypeDelete(id) {
    try {
        await apiService.deleteAssetType(id);
        showNotification('Asset type deleted successfully', 'success');
        await renderAssetTypesCardsPage();
    } catch (error) {
        console.error('Error deleting asset type:', error);
        showNotification('Error deleting asset type', 'error');
    }
}

async function handleAssetDelete(assetId) {
    try {
        await apiService.deleteAsset(assetId);
        showNotification('Asset deleted successfully', 'success');
        await renderAssetTypeSpreadsheetPage(selectedAssetTypeId);
    } catch (error) {
        console.error('Error deleting asset:', error);
        showNotification('Error deleting asset', 'error');
    }
}

async function handleAssetUpdate(asset, type, field_values) {
    try {
        if (asset.id) {
            await apiService.updateAsset({ id: asset.id, type_id: type.id, field_values });
            showNotification('Asset updated successfully', 'success');
        } else {
            await apiService.addAsset({ type_id: type.id, field_values });
            showNotification('Asset added successfully', 'success');
        }
        await renderAssetTypeSpreadsheetPage(type.id);
    } catch (error) {
        console.error('Error saving asset:', error);
        showNotification('Error saving asset', 'error');
    }
}

async function handleAssetTypeUpdate(type, name, fields, default_sort_field, default_sort_asc) {
    try {
        if (type.id) {
            await apiService.updateAssetType({ id: type.id, name, fields, default_sort_field, default_sort_asc });
            showNotification('Asset type updated successfully', 'success');
        } else {
            await apiService.addAssetType({ name, fields, default_sort_field, default_sort_asc });
            showNotification('Asset type added successfully', 'success');
        }
        await renderAssetTypesCardsPage();
    } catch (error) {
        console.error('Error saving asset type:', error);
        showNotification('Error saving asset type', 'error');
    }
}

// Category and file operation handlers
async function handleCategorySettings() {
    try {
        showCategorySettingsModal();
    } catch (error) {
        console.error('Error showing category settings:', error);
        showNotification('Error showing category settings', 'error');
    }
}

async function handleAddCategory(categoryData) {
    try {
        await apiService.addCategory(categoryData);
        showNotification('Category added successfully', 'success');
        await refreshCategories();
    } catch (error) {
        console.error('Error adding category:', error);
        showNotification('Error adding category', 'error');
    }
}

async function handleToggleFavorite(entryId) {
    try {
        const result = await apiService.toggleFavorite(entryId);
        return result;
    } catch (error) {
        console.error('Error toggling favorite:', error);
        showNotification('Error updating favorite status', 'error');
    }
}

async function handleFileOperations(file) {
    try {
        if (file.path) {
            await apiService.openFile(file.path);
            await apiService.incrementViewCount(file.entryId);
            showNotification('File opened successfully', 'success');
        }
    } catch (error) {
        console.error('Error handling file operations:', error);
        showNotification('Error handling file operations', 'error');
    }
}

async function handleRatingSubmit(ratingData) {
    try {
        await apiService.addRating(ratingData);
        showNotification('Rating added successfully', 'success');
    } catch (error) {
        console.error('Error adding rating:', error);
        showNotification('Error adding rating', 'error');
    }
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initApp();
});

// Category settings modal
function showCategorySettingsModal() {
    const modal = document.getElementById('category-settings-modal');
    if (modal) {
        modal.style.display = 'block';
        loadCategoriesList();
        resetCategoryForm();
    }
}

async function loadCategoriesList() {
    try {
        categories = await apiService.getCategories();
        const categoriesList = document.querySelector('#category-settings-modal .categories-list');
        if (!categoriesList) return;

        const paginationContainer = document.getElementById('categories-pagination');
        if (paginationContainer) {
            paginationContainer.remove();
        }

        categoriesList.innerHTML = `
            <div class="add-category-button">
                <i class="fas fa-plus"></i>
                Add New Category
            </div>
        `;

        const addButton = categoriesList.querySelector('.add-category-button');
        if (addButton) {
            addButton.addEventListener('click', startNewCategory);
        }

        if (categories.length > 0) {
            renderCategoriesList(categoriesList, categories);
        }
    } catch (error) {
        console.error('Error loading categories list:', error);
        showNotification('Error loading categories', 'error');
    }
}

function renderCategoriesList(container, categories) {
    const categoriesHtml = categories.map(category => `
        <div class="category-item" data-id="${category.id}">
            <div class="category-info">
                <i class="fas fa-${category.icon || 'folder'}" style="color: ${category.color || '#3498db'}"></i>
                <span>${category.name}</span>
            </div>
            <div class="category-actions">
                <button class="edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
    
    container.insertAdjacentHTML('beforeend', categoriesHtml);
    
    // Add event listeners to category items
    container.querySelectorAll('.category-item').forEach(item => {
        const categoryId = item.dataset.id;
        const category = categories.find(c => c.id === categoryId);
        
        if (category) {
            item.querySelector('.edit-btn')?.addEventListener('click', () => {
                selectCategory(category);
            });
            
            item.querySelector('.delete-btn')?.addEventListener('click', async () => {
                if (confirm(`Are you sure you want to delete "${category.name}"?`)) {
                    try {
                        await apiService.deleteCategory(categoryId);
                        await loadCategoriesList();
                        showNotification('Category deleted successfully', 'success');
                    } catch (error) {
                        console.error('Error deleting category:', error);
                        showNotification('Error deleting category', 'error');
                    }
                }
            });
        }
    });
}

// Event Listeners for categories
document.getElementById('categoryForm')?.addEventListener('submit', handleCategorySubmit);
document.querySelector('#categoryModal .close')?.addEventListener('click', hideCategoryModal);
document.getElementById('category-settings-btn')?.addEventListener('click', showCategorySettingsModal);

// Initialize categories on load
loadCategories();

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initApp();
});

// Web-compatible loadNotifications for migration from Electron
async function loadNotifications() {
    try {
        const notifications = await apiService.getNotifications();
        // TODO: Render notifications in the UI if needed
        console.log('Loaded notifications:', notifications);
    } catch (error) {
        console.error('Error loading notifications:', error);
        showNotification('Error loading notifications', 'error');
    }
}

// Web-compatible loadTheme for migration from Electron
async function loadTheme() {
    try {
        const theme = await apiService.getCurrentTheme();
        if (theme) {
            apiService.applyTheme(theme);
        }
    } catch (error) {
        console.error('Error loading theme:', error);
        showNotification('Error loading theme', 'error');
    }
}

// Web-compatible initializeShortcuts for migration from Electron
function initializeShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Example: Ctrl+S to save (prevent default browser save)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            // Trigger save if a modal is open, or show a notification
            const saveBtn = document.querySelector('.modal-content .btn-primary');
            if (saveBtn) saveBtn.click();
            else showNotification('No save action available', 'info');
        }
        // Example: Ctrl+F to focus search
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            const searchInput = document.querySelector('.search-container input');
            if (searchInput) searchInput.focus();
        }
        // Add more shortcuts as needed
    });
}

// Web-compatible restoreWindowState for migration from Electron
function restoreWindowState() {
    // No-op in web: Electron restored window size/position, not needed here
}

// Render the Asset Types cards page
async function renderAssetTypesCardsPage() {
    try {
        const assetTypes = await apiService.getAssetTypes();
        entriesContainer.innerHTML = `
            <div class="asset-types-page">
                <div class="asset-types-header">
                    <h2><i class="fas fa-database"></i> Asset Types</h2>
                    <button class="add-asset-type-btn"><i class="fas fa-plus"></i> New Asset Type</button>
                </div>
                <div class="asset-types-grid">
                    ${assetTypes.map(type => `
                        <div class="asset-type-card" data-type-id="${type.id}">
                            <h3>${type.name}</h3>
                            <div class="asset-type-actions">
                                <button class="view-assets-btn" title="View Assets"><i class="fas fa-table"></i></button>
                                <button class="edit-asset-type-btn" title="Edit"><i class="fas fa-edit"></i></button>
                                <button class="delete-asset-type-btn" title="Delete"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        // Add event listeners
        entriesContainer.querySelector('.add-asset-type-btn').addEventListener('click', () => showAssetTypeModal());
        entriesContainer.querySelectorAll('.view-assets-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.asset-type-card');
                selectedAssetTypeId = card.dataset.typeId;
                assetManagerView = 'type';
                renderAssetManagerPage();
            });
        });
        entriesContainer.querySelectorAll('.edit-asset-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.asset-type-card');
                const typeId = card.dataset.typeId;
                apiService.getAssetTypes().then(types => {
                    const type = types.find(t => t.id === typeId);
                    showAssetTypeModal(type);
                });
            });
        });
        entriesContainer.querySelectorAll('.delete-asset-type-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const card = e.target.closest('.asset-type-card');
                if (confirm('Delete this asset type?')) {
                    await handleAssetTypeDelete(card.dataset.typeId);
                }
            });
        });
    } catch (error) {
        console.error('Error rendering asset types:', error);
        showNotification('Error loading asset types', 'error');
    }
}

// Render the Asset Type spreadsheet page
async function renderAssetTypeSpreadsheetPage(typeId) {
    try {
        // Show loading spinner
        entriesContainer.innerHTML = '<div class="assets-spinner"></div>';
        const [type, assets] = await Promise.all([
            apiService.getAssetTypes().then(types => types.find(t => t.id === typeId)),
            apiService.getAssets(typeId)
        ]);
        console.log('Loaded asset type:', type);
        console.log('Asset type fields:', type ? type.fields : undefined);
        // Parse fields if needed
        let fields = type.fields;
        if (typeof fields === 'string') {
            try {
                fields = JSON.parse(fields);
            } catch (e) {
                fields = [];
            }
        }
        // Sorting state
        let sortField = fields[0]?.name || '';
        let sortAsc = true;
        let filterText = '';
        let selectedAssets = new Set();
        let currentPage = 1;
        let pageSize = 10;
        // Helper to sort and filter assets
        function getFilteredSortedAssets() {
            let filtered = assets;
            if (filterText) {
                filtered = filtered.filter(asset => {
                    const values = asset.fields || {};
                    return fields.some(f => (values[f.name] || '').toLowerCase().includes(filterText.toLowerCase()));
                });
            }
            if (sortField) {
                filtered = [...filtered].sort((a, b) => {
                    const va = (a.fields || {})[sortField] || '';
                    const vb = (b.fields || {})[sortField] || '';
                    if (va < vb) return sortAsc ? -1 : 1;
                    if (va > vb) return sortAsc ? 1 : -1;
                    return 0;
                });
            }
            return filtered;
        }
        // Helper to render table
        function renderTable(filteredAssets) {
            // Pagination
            const totalItems = filteredAssets.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
            if (currentPage > totalPages) currentPage = totalPages;
            const startIdx = (currentPage - 1) * pageSize;
            const endIdx = Math.min(startIdx + pageSize, totalItems);
            const paginatedAssets = filteredAssets.slice(startIdx, endIdx);

            // Force entriesContainer and asset-type-page to fill main content area
            entriesContainer.style.maxWidth = 'none';
            entriesContainer.style.width = '100%';
            entriesContainer.style.margin = '0';
            entriesContainer.style.padding = '0';
            entriesContainer.style.display = 'block';

            // Smart column width calculation (percentages)
            const fixedWidthsPx = {
                checkbox: 40,
                actions: 80
            };
            const typeWeights = {
                text: 3,
                number: 1.5,
                date: 1.2,
                time: 1.2,
                location: 1.5,
                weblink: 2,
                select: 1.2
            };
            // Use the width of entriesContainer's parent (main-content) for calculation
            const parentWidth = entriesContainer.parentElement ? entriesContainer.parentElement.offsetWidth : window.innerWidth;
            const tableWidthPx = parentWidth;
            const totalFixedPx = fixedWidthsPx.checkbox + fixedWidthsPx.actions;
            const fieldWeights = fields.map(f => typeWeights[f.type] || 2);
            const totalWeight = fieldWeights.reduce((a, b) => a + b, 0);
            const availablePx = tableWidthPx - totalFixedPx;
            const fieldPercents = fields.map((f, i) => {
                const px = (fieldWeights[i] / totalWeight) * availablePx;
                return (px / tableWidthPx) * 100;
            });
            const checkboxPercent = (fixedWidthsPx.checkbox / tableWidthPx) * 100;
            const actionsPercent = (fixedWidthsPx.actions / tableWidthPx) * 100;

            entriesContainer.innerHTML = `
                <div class="asset-type-page" style="max-width:none;width:100%;margin:0;padding:0;display:block;overflow-x:auto;">
                    <div class="asset-type-header" style="max-width:none;width:100%;margin:0;padding:0;">
                        <button class="back-to-types-btn"><i class="fas fa-arrow-left"></i> Back</button>
                        <h2><i class="fas fa-table"></i> ${type.name} Assets</h2>
                        <button class="add-asset-btn"><i class="fas fa-plus"></i> New Asset</button>
                        <button class="bulk-delete-btn" style="margin-left:16px;${selectedAssets.size ? '' : 'display:none;'}"><i class="fas fa-trash"></i> Delete Selected</button>
                        <input class="asset-search-input" type="text" placeholder="Search assets..." style="margin-left:24px;min-width:200px;" value="${filterText}">
                        <select class="asset-page-size-select" style="margin-left:16px;">
                            <option value="5" ${pageSize==5?'selected':''}>5</option>
                            <option value="10" ${pageSize==10?'selected':''}>10</option>
                            <option value="25" ${pageSize==25?'selected':''}>25</option>
                            <option value="50" ${pageSize==50?'selected':''}>50</option>
                        </select>
                    </div>
                    <div class="assets-table-wrapper" style="overflow-x:auto;width:100%;">
                    <table class="assets-table" style="width:100%;min-width:900px;">
                        <thead>
                            <tr>
                                <th class="col-checkbox" style="width:${checkboxPercent}%;min-width:40px"><input type="checkbox" class="bulk-checkbox-all" ${selectedAssets.size && paginatedAssets.every(a=>selectedAssets.has(a.id)) ? 'checked' : ''}></th>
                                ${fields.map((f, i) => {
                                    const colClass = `col-${f.type}`;
                                    // Set a min-width for usability
                                    return `<th class="${colClass} sortable" data-field="${f.name}" style="width:${fieldPercents[i]}%;min-width:120px;">${f.name} <i class="fas fa-sort"></i></th>`;
                                }).join('')}
                                <th class="col-actions" style="width:${actionsPercent}%;min-width:80px">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="quick-add-row">
                                <td class="col-checkbox" style="width:${checkboxPercent}%;min-width:40px"></td>
                                ${fields.map((f, i) => {
                                    const colClass = `col-${f.type}`;
                                    const style = `style=\"width:${fieldPercents[i]}%;min-width:120px;\"`;
                                    if (f.type === 'number') {
                                        return `<td class="${colClass}" ${style}><input type="number" name="${f.name}" class="quick-add-input"></td>`;
                                    } else if (f.type === 'date') {
                                        return `<td class="${colClass}" ${style}><input type="date" name="${f.name}" class="quick-add-input"></td>`;
                                    } else if (f.type === 'time') {
                                        return `<td class="${colClass}" ${style}><input type="time" name="${f.name}" class="quick-add-input"></td>`;
                                    } else if (f.type === 'location') {
                                        return `<td class="${colClass}" ${style}><input type="text" name="${f.name}" class="quick-add-input" placeholder="Location"></td>`;
                                    } else if (f.type === 'weblink') {
                                        return `<td class="${colClass}" ${style}><input type="url" name="${f.name}" class="quick-add-input" placeholder="https://example.com"></td>`;
                                    } else if (f.type === 'select') {
                                        const opts = (f.options || '').split(',').map(opt => opt.trim()).filter(Boolean);
                                        return `<td class="${colClass}" ${style}><select name="${f.name}" class="quick-add-input">${opts.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select></td>`;
                                    } else {
                                        return `<td class="${colClass}" ${style}><input type="text" name="${f.name}" class="quick-add-input"></td>`;
                                    }
                                }).join('')}
                                <td class="col-actions" style="width:${actionsPercent}%;min-width:80px"><button class="quick-add-save-btn"><i class="fas fa-check"></i></button></td>
                            </tr>
                            ${paginatedAssets.length === 0 ? `<tr><td colspan="${fields.length + 2}"><div class="assets-empty-state"><i class="fas fa-box-open"></i><div>No assets found.</div></div></td></tr>` : ''}
                            ${paginatedAssets.map(asset => {
                                const values = asset.fields || {};
                                return `<tr data-asset-id="${asset.id}">
                                    <td class="col-checkbox" style="width:${checkboxPercent}%;min-width:40px"><input type="checkbox" class="bulk-checkbox" data-id="${asset.id}" ${selectedAssets.has(asset.id) ? 'checked' : ''}></td>
                                    ${fields.map((f, i) => {
                                        const colClass = `col-${f.type}`;
                                        const value = values[f.name] || '';
                                        const style = `style=\"width:${fieldPercents[i]}%;min-width:120px;\"`;
                                        return `<td class="${colClass} editable-cell" data-field="${f.name}" data-type="${f.type}" ${style}>${value}</td>`;
                                    }).join('')}
                                    <td class="col-actions" style="width:${actionsPercent}%;min-width:80px">
                                        <button class="edit-asset-btn" title="Edit"><i class="fas fa-edit"></i></button>
                                        <button class="delete-asset-btn" title="Delete"><i class="fas fa-trash"></i></button>
                                    </td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                    </div>
                    <div id="assets-pagination"></div>
                </div>
            `;

            // Attach event listeners inside the new .assets-table-wrapper
            const tableWrapper = entriesContainer.querySelector('.assets-table-wrapper');
            const tableScope = tableWrapper ? tableWrapper : entriesContainer;

            // Bulk select
            tableScope.querySelector('.bulk-checkbox-all')?.addEventListener('change', e => {
                const checked = e.target.checked;
                paginatedAssets.forEach(asset => {
                    if (checked) selectedAssets.add(asset.id);
                    else selectedAssets.delete(asset.id);
                });
                renderTable(getFilteredSortedAssets());
            });
            tableScope.querySelectorAll('.bulk-checkbox').forEach(cb => {
                cb.addEventListener('change', e => {
                    const id = cb.dataset.id;
                    if (cb.checked) selectedAssets.add(id);
                    else selectedAssets.delete(id);
                    renderTable(getFilteredSortedAssets());
                });
            });
            // Bulk delete
            const bulkDeleteBtn = entriesContainer.querySelector('.bulk-delete-btn');
            if (bulkDeleteBtn) {
                bulkDeleteBtn.addEventListener('click', async () => {
                    if (!selectedAssets.size) return;
                    if (!confirm('Delete selected assets?')) return;
                    for (const id of selectedAssets) {
                        await handleAssetDelete(id);
                    }
                    selectedAssets.clear();
                    renderTable(getFilteredSortedAssets());
                });
            }
            // Back button
            entriesContainer.querySelector('.back-to-types-btn').addEventListener('click', () => {
                assetManagerView = 'list';
                renderAssetManagerPage();
            });
            // Add asset modal
            entriesContainer.querySelector('.add-asset-btn').addEventListener('click', () => showAddAssetModal(type));
            // Edit/delete asset
            tableScope.querySelectorAll('.edit-asset-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const row = e.target.closest('tr');
                    const assetId = row.dataset.assetId;
                    const asset = assets.find(a => a.id === assetId);
                    showAddAssetModal(type, asset);
                });
            });
            tableScope.querySelectorAll('.delete-asset-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const row = e.target.closest('tr');
                    if (confirm('Delete this asset?')) {
                        await handleAssetDelete(row.dataset.assetId);
                        renderTable(getFilteredSortedAssets());
                    }
                });
            });
            // Inline editing for cells
            tableScope.querySelectorAll('.editable-cell').forEach(cell => {
                cell.addEventListener('click', function() {
                    if (cell.querySelector('input, select')) return; // Already editing
                    const field = cell.dataset.field;
                    const typeVal = cell.dataset.type;
                    const oldValue = cell.textContent;
                    let input;
                    if (typeVal === 'number') {
                        input = document.createElement('input');
                        input.type = 'number';
                    } else if (typeVal === 'date') {
                        input = document.createElement('input');
                        input.type = 'date';
                    } else if (typeVal === 'time') {
                        input = document.createElement('input');
                        input.type = 'time';
                    } else if (typeVal === 'location') {
                        input = document.createElement('input');
                        input.type = 'text';
                        input.placeholder = 'Location';
                    } else if (typeVal === 'weblink') {
                        input = document.createElement('input');
                        input.type = 'url';
                        input.placeholder = 'https://example.com';
                    } else if (typeVal === 'select') {
                        input = document.createElement('select');
                        const opts = fields.find(f => f.name === field).options.split(',').map(opt => opt.trim()).filter(Boolean);
                        opts.forEach(opt => {
                            const option = document.createElement('option');
                            option.value = opt;
                            option.textContent = opt;
                            if (opt === oldValue) option.selected = true;
                            input.appendChild(option);
                        });
                    } else {
                        input = document.createElement('input');
                        input.type = 'text';
                    }
                    input.value = oldValue;
                    input.className = 'inline-edit-input';
                    cell.textContent = '';
                    cell.appendChild(input);
                    input.focus();
                    input.addEventListener('blur', async function() {
                        await saveInlineEdit(cell, input.value, typeId, fields, assets);
                        renderTable(getFilteredSortedAssets());
                    });
                    input.addEventListener('keydown', async function(e) {
                        if (e.key === 'Enter') {
                            input.blur();
                        } else if (e.key === 'Escape') {
                            cell.textContent = oldValue;
                        }
                    });
                });
            });
            // Keyboard navigation for quick-add row
            const quickAddInputs = tableScope.querySelectorAll('.quick-add-input');
            quickAddInputs.forEach((input, idx) => {
                input.addEventListener('keydown', e => {
                    if (e.key === 'Enter') {
                        entriesContainer.querySelector('.quick-add-save-btn').click();
                    } else if (e.key === 'ArrowRight' && idx < quickAddInputs.length - 1) {
                        quickAddInputs[idx + 1].focus();
                    } else if (e.key === 'ArrowLeft' && idx > 0) {
                        quickAddInputs[idx - 1].focus();
                    }
                });
            });
            // Quick add row
            const quickAddBtn = entriesContainer.querySelector('.quick-add-save-btn');
            quickAddBtn.addEventListener('click', async () => {
                const row = quickAddBtn.closest('tr');
                const inputs = row.querySelectorAll('.quick-add-input');
                const fieldsObj = {};
                fields.forEach((f, i) => {
                    fieldsObj[f.name] = inputs[i].value;
                });
                try {
                    await apiService.addAsset({ type_id: typeId, fields: fieldsObj });
                    showNotification('Asset added', 'success');
                    currentPage = 1;
                    renderTable(getFilteredSortedAssets());
                } catch (err) {
                    showNotification('Error adding asset', 'error');
                }
            });

            // ... rest of the existing table setup code ...
        }
        // Initial render
        renderTable(getFilteredSortedAssets());
    } catch (error) {
        console.error('Error rendering assets:', error);
        showNotification('Error loading assets', 'error');
    }
}

// Helper for inline editing
async function saveInlineEdit(cell, newValue, typeId, fields, assets) {
    const row = cell.closest('tr');
    const assetId = row.dataset.assetId;
    const field = cell.dataset.field;
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    const updatedValues = { ...(asset.fields || {}), [field]: newValue };
    try {
        await apiService.updateAsset({ id: assetId, type_id: typeId, fields: updatedValues });
        cell.textContent = newValue;
        showNotification('Saved', 'success');
    } catch (err) {
        cell.textContent = asset.fields[field] || '';
        showNotification('Error saving', 'error');
    }
}

// --- Asset Type Modal Implementation ---
function showAssetTypeModal(type = null) {
    // Remove any existing modal
    document.getElementById('asset-type-modal')?.remove();

    // Create modal HTML
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'asset-type-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>${type ? 'Edit' : 'Add'} Asset Type</h2>
            <form id="asset-type-form">
                <div class="form-group">
                    <label for="type-name">Name:</label>
                    <input type="text" id="type-name" name="name" required value="${type ? type.name : ''}">
                </div>
                <div class="form-group">
                    <label>Fields:</label>
                    <div id="fields-container"></div>
                    <button type="button" class="add-field-btn"><i class="fas fa-plus"></i> Add Field</button>
                </div>
                <div class="modal-buttons">
                    <button type="button" class="cancel-btn">Cancel</button>
                    <button type="submit" class="save-btn">Save</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';

    // Field management
    const fieldsContainer = modal.querySelector('#fields-container');
    function addFieldRow(name = '', typeVal = 'text', options = '') {
        const row = document.createElement('div');
        row.className = 'field-row';
        row.innerHTML = `
            <input type="text" class="field-name-input" placeholder="Field name" value="${name}">
            <select class="field-type-select">
                <option value="text" ${typeVal === 'text' ? 'selected' : ''}>Text</option>
                <option value="number" ${typeVal === 'number' ? 'selected' : ''}>Number</option>
                <option value="date" ${typeVal === 'date' ? 'selected' : ''}>Date</option>
                <option value="time" ${typeVal === 'time' ? 'selected' : ''}>Time</option>
                <option value="location" ${typeVal === 'location' ? 'selected' : ''}>Location</option>
                <option value="weblink" ${typeVal === 'weblink' ? 'selected' : ''}>Web Link</option>
                <option value="select" ${typeVal === 'select' ? 'selected' : ''}>Dropdown</option>
            </select>
            <input type="text" class="field-options-input" placeholder="Options (comma separated)" value="${options}" style="display:${typeVal === 'select' ? 'inline-block' : 'none'};width:180px;">
            <button type="button" class="remove-field-btn"><i class="fas fa-times"></i></button>
        `;
        const typeSelect = row.querySelector('.field-type-select');
        const optionsInput = row.querySelector('.field-options-input');
        typeSelect.addEventListener('change', () => {
            optionsInput.style.display = typeSelect.value === 'select' ? 'inline-block' : 'none';
        });
        row.querySelector('.remove-field-btn').addEventListener('click', () => row.remove());
        fieldsContainer.appendChild(row);
    }
    modal.querySelector('.add-field-btn').addEventListener('click', () => addFieldRow());
    // If editing, populate fields
    if (type && Array.isArray(type.fields)) {
        type.fields.forEach(f => addFieldRow(f.name, f.type, f.options || ''));
    }

    // Modal close logic
    function closeModal() { modal.remove(); }
    modal.querySelector('.cancel-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Form submit logic
    modal.querySelector('#asset-type-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = modal.querySelector('#type-name').value.trim();
        const fields = Array.from(fieldsContainer.querySelectorAll('.field-row')).map(row => {
            const fieldName = row.querySelector('.field-name-input').value.trim();
            const fieldType = row.querySelector('.field-type-select').value;
            const fieldOptions = row.querySelector('.field-options-input').value.trim();
            return fieldType === 'select'
                ? { name: fieldName, type: fieldType, options: fieldOptions }
                : { name: fieldName, type: fieldType };
        }).filter(f => f.name);
        if (!name) {
            showNotification('Asset type name is required', 'error');
            return;
        }
        try {
            if (type && type.id) {
                await apiService.updateAssetType({ id: type.id, name, fields });
                showNotification('Asset type updated successfully', 'success');
            } else {
                await apiService.addAssetType({ name, fields });
                showNotification('Asset type added successfully', 'success');
            }
            closeModal();
            await renderAssetTypesCardsPage();
            // If editing, refresh spreadsheet view if open
            if (type && type.id && assetManagerView === 'type' && selectedAssetTypeId === type.id) {
                await renderAssetTypeSpreadsheetPage(type.id);
            }
        } catch (error) {
            showNotification('Error saving asset type', 'error');
        }
    });
}

// --- Asset Modal Implementation ---
async function showAddAssetModal(type, asset = null) {
    // Remove any existing modal
    document.getElementById('asset-modal')?.remove();

    // Create modal HTML
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'asset-modal';
    const fields = Array.isArray(type.fields) ? type.fields : [];
    const existingFiles = asset && asset.files ? asset.files : [];
    modal.innerHTML = `
        <div class="modal-content">
            <h2>${asset ? 'Edit' : 'Add'} Asset</h2>
            <form id="asset-form">
                <div id="asset-fields-container">
                    ${fields.map(f => {
                        const value = asset && asset.field_values ? (asset.field_values[f.name] || '') : '';
                        if (f.type === 'number') {
                            return `<div class="form-group"><label>${f.name}:</label><input type="number" name="${f.name}" value="${value}" required></div>`;
                        } else if (f.type === 'date') {
                            return `<div class="form-group"><label>${f.name}:</label><input type="date" name="${f.name}" value="${value}" required></div>`;
                        } else if (f.type === 'time') {
                            return `<div class="form-group"><label>${f.name}:</label><input type="time" name="${f.name}" value="${value}" required></div>`;
                        } else if (f.type === 'location') {
                            return `<div class="form-group"><label>${f.name}:</label><input type="text" name="${f.name}" value="${value}" placeholder="Enter location (address or coordinates)" required></div>`;
                        } else if (f.type === 'weblink') {
                            return `<div class="form-group"><label>${f.name}:</label><input type="url" name="${f.name}" value="${value}" placeholder="https://example.com" required></div>`;
                        } else if (f.type === 'select') {
                            const opts = (f.options || '').split(',').map(opt => opt.trim()).filter(Boolean);
                            return `<div class="form-group"><label>${f.name}:</label><select name="${f.name}" required>${opts.map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`).join('')}</select></div>`;
                        } else {
                            return `<div class="form-group"><label>${f.name}:</label><input type="text" name="${f.name}" value="${value}" required></div>`;
                        }
                    }).join('')}
                </div>
                <div class="form-group">
                    <label>Files:</label>
                    <div class="file-upload-container">
                        <div class="file-drop-zone" id="file-drop-zone">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <p>Drag & drop files here or click to browse</p>
                            <input type="file" id="asset-file-input" name="files" multiple>
                        </div>
                        <div class="file-restrictions">
                            <p>Allowed file types: Images, PDFs, Documents</p>
                            <p>Max file size: 10MB per file</p>
                        </div>
                    </div>
                    <div id="asset-files-list" class="files-list"></div>
                </div>
                <div class="modal-buttons">
                    <button type="button" class="cancel-btn">Cancel</button>
                    <button type="submit" class="save-btn">Save</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';

    // File management
    let attachedFiles = [...existingFiles];
    const fileInput = modal.querySelector('#asset-file-input');
    const filesList = modal.querySelector('#asset-files-list');
    const dropZone = modal.querySelector('#file-drop-zone');

    // File type validation
    const allowedTypes = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
    };
    const maxFileSize = 10 * 1024 * 1024; // 10MB

    function validateFile(file) {
        if (!allowedTypes[file.type]) {
            showNotification(`File type not allowed: ${file.name}`, 'error');
            return false;
        }
        if (file.size > maxFileSize) {
            showNotification(`File too large: ${file.name} (max 10MB)`, 'error');
            return false;
        }
        return true;
    }

    function renderFilesList() {
        filesList.innerHTML = attachedFiles.length
            ? `<ul>${attachedFiles.map((f, i) => {
                const file = f instanceof File ? f : { name: f.name || f, type: f.type || '' };
                const isImage = file.type.startsWith('image/');
                const preview = isImage 
                    ? `<img src="${f instanceof File ? URL.createObjectURL(f) : f.path}" alt="${file.name}">`
                    : `<i class="fas fa-file"></i>`;
                return `
                    <li>
                        <div class="file-preview">${preview}</div>
                        <div class="file-info">
                            <span class="file-name">${file.name}</span>
                            <span class="file-size">${formatFileSize(f instanceof File ? f.size : f.size || 0)}</span>
                        </div>
                        <button type="button" data-index="${i}" class="remove-asset-file-btn" title="Remove file">
                            <i class="fas fa-times"></i>
                        </button>
                    </li>
                `;
            }).join('')}</ul>`
            : '<div class="no-files">No files attached</div>';
        
        filesList.querySelectorAll('.remove-asset-file-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                const file = attachedFiles[idx];
                if (file instanceof File) {
                    URL.revokeObjectURL(file);
                }
                attachedFiles.splice(idx, 1);
                renderFilesList();
            });
        });
    }

    // Format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Drag and drop handling
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        handleFiles(files);
    });

    // Click to upload
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    function handleFiles(files) {
        const validFiles = files.filter(validateFile);
        if (validFiles.length > 0) {
            attachedFiles.push(...validFiles);
            renderFilesList();
        }
    }

    fileInput.addEventListener('change', (e) => {
        handleFiles(Array.from(e.target.files));
        fileInput.value = '';
    });

    renderFilesList();

    // Modal close logic
    function closeModal() {
        // Clean up object URLs
        attachedFiles.forEach(file => {
            if (file instanceof File) {
                URL.revokeObjectURL(file);
            }
        });
        modal.remove();
    }

    modal.querySelector('.cancel-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Form submit logic
    modal.querySelector('#asset-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Validate form fields
        const fieldInputs = Array.from(modal.querySelectorAll('#asset-fields-container input, #asset-fields-container select'));
        const field_values = {};
        let isValid = true;
        
        for (const input of fieldInputs) {
            const value = input.value.trim();
            if (!value && input.required) {
                input.classList.add('error');
                isValid = false;
            } else {
                input.classList.remove('error');
                field_values[input.name] = value;
            }
        }

        if (!isValid) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }

        // Upload new files if any
        let uploadedFiles = [];
        for (const file of attachedFiles) {
            if (file instanceof File) {
                try {
                    const result = await apiService.uploadFile(file);
                    uploadedFiles.push({ name: file.name, path: result.filePath });
                } catch (err) {
                    showNotification('Error uploading file: ' + file.name, 'error');
                }
            } else {
                uploadedFiles.push(file); // Already uploaded
            }
        }

        try {
            if (asset && asset.id) {
                await apiService.updateAsset({ id: asset.id, type_id: type.id, field_values, files: uploadedFiles });
                showNotification('Asset updated successfully', 'success');
            } else {
                await apiService.addAsset({ type_id: type.id, field_values, files: uploadedFiles });
                showNotification('Asset added successfully', 'success');
            }
            closeModal();
            await renderAssetTypeSpreadsheetPage(type.id);
        } catch (error) {
            showNotification('Error saving asset', 'error');
        }
    });
}

// Suppress specific harmless async listener error in browser console
window.addEventListener('unhandledrejection', function(event) {
    if (
        event.reason &&
        typeof event.reason.message === 'string' &&
        event.reason.message.includes('A listener indicated an asynchronous response')
    ) {
        event.preventDefault();
    }
});