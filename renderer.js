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

// Category Settings Modal Management
let selectedCategoryId = null;

// Initialize the app
async function initApp() {
    try {
        console.log('Starting app initialization...');
        
        // Load config
        console.log('Loading config...');
        config = await window.api.getConfig();
        updateDeviceInfo();
        console.log('Config loaded:', config);

        // Load categories
        console.log('Loading categories...');
        categories = await window.api.getCategories();
        console.log('Categories loaded:', categories);
        
        if (!Array.isArray(categories)) {
            throw new Error('Invalid categories data received');
        }
        
        // Set up event listeners first
        setupEventListeners();
        
        // Initialize modal
        initializeModal();
        
        // Render categories
        renderCategories(categories);

        // Load entries for the first category if available
        if (categories && categories.length > 0) {
            console.log('Loading initial category:', categories[0]);
            currentCategory = categories[0].id;
            await loadEntries(currentCategory);
            
            // Update active state of first category
            const firstCategoryItem = document.querySelector('.category-item');
            if (firstCategoryItem) {
                firstCategoryItem.classList.add('active');
            }
        } else {
            console.log('No categories available');
            entriesContainer.innerHTML = `
                <div class="no-categories">
                    <p>No categories available. Please add a category first.</p>
                    <button class="add-category-btn">
                        <i class="fas fa-plus"></i>
                        Add Category
                    </button>
                </div>
            `;
            
            // Add click handler for the add category button
            const addCategoryBtn = entriesContainer.querySelector('.add-category-btn');
            if (addCategoryBtn) {
                addCategoryBtn.addEventListener('click', handleAddCategory);
            }
        }

        console.log('App initialization complete');
    } catch (error) {
        console.error('Error initializing app:', error);
        entriesContainer.innerHTML = `
            <div class="error-message">
                <p>Error initializing the application.</p>
                <button onclick="window.location.reload()">Refresh Page</button>
                <details>
                    <summary>Error Details (for debugging)</summary>
                    <pre>${error.message}</pre>
                </details>
            </div>
        `;
    }
}

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
    // Search functionality
    const searchInput = document.querySelector('.search-container input');
    const searchClearBtn = document.querySelector('.search-clear-btn');
    
    searchInput.addEventListener('input', debounce(async (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
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
            const categories = await window.api.getCategories();
            
            // Search across all entries
            const allEntries = [];
            for (const category of categories) {
                const categoryEntries = await window.api.getEntries(category.id);
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
                        const entryData = await window.api.getEntry(entryId);
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
    }, 300));
    
    searchClearBtn.addEventListener('click', async () => {
        searchInput.value = '';
        searchClearBtn.classList.remove('visible');
        if (!currentCategory) {
            await renderDashboard();
        } else {
            await loadEntries(currentCategory);
        }
    });

    // Add Entry button
    addEntryBtn.addEventListener('click', () => showModal());

    // Form submission
    entryForm.addEventListener('submit', handleEntrySubmit);

    // Listen for export/import events from the menu
    window.api.receive('export-data', handleExport);
    window.api.receive('import-data', handleImport);
}

// Render categories in the sidebar
function renderCategories(categories) {
    categoryList.innerHTML = `
        <div class="category-item ${!currentCategory ? 'active' : ''}" data-id="dashboard">
            <h3><i class="fas fa-home"></i> Dashboard</h3>
            <span class="entry-count">Home</span>
        </div>
        ${categories.map(category => `
            <div class="category-item ${category.id === currentCategory ? 'active' : ''}" 
                 data-id="${category.id}"
                 style="--category-color: ${category.color || '#3498db'}">
                <h3><i class="fas fa-${category.icon || 'folder'}"></i> ${category.name}</h3>
                <span class="entry-count">${category.entryCount || 0} entries</span>
            </div>
        `).join('')}
    `;

    // Add click event to categories
    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', async () => {
            const categoryId = item.dataset.id;
            
            // Update active state
            document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            if (categoryId === 'dashboard') {
                currentCategory = null;
                await renderDashboard();
            } else {
                currentCategory = categoryId;
                await loadEntries(currentCategory);
            }
        });
    });
}

// Load entries for a category
async function loadEntries(categoryId) {
    try {
        console.log('Loading entries for category:', categoryId);
        if (!categoryId) {
            console.error('No category ID provided to loadEntries');
            entriesContainer.innerHTML = '<p>Error: No category selected. Please select a category.</p>';
            return;
        }
        
        // Show loading state
        entriesContainer.innerHTML = '<div class="loading">Loading entries...</div>';
        
        // Add debug logging
        console.log('Calling window.api.getEntries with categoryId:', categoryId);
        entries = await window.api.getEntries(categoryId);
        console.log('Entries loaded:', entries);
        
        if (!Array.isArray(entries)) {
            console.error('Received invalid entries data:', entries);
            throw new Error('Invalid entries data received');
        }
        
        renderEntries(entries);
    } catch (error) {
        console.error('Error loading entries:', error);
        entriesContainer.innerHTML = `
            <div class="error-message">
                <p>Error loading entries. Please try refreshing the page.</p>
                <button onclick="window.location.reload()">Refresh Page</button>
                <details>
                    <summary>Error Details (for debugging)</summary>
                    <pre>${error.message}</pre>
                </details>
            </div>
        `;
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
        await window.api.addRating({
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

    // Initial render with default sort (alphabetical by title)
    const sortedEntries = sortEntries(entriesToRender || [], 'title');
    renderEntriesList(sortedEntries);

    // Add sort change listener after elements are in the DOM
    const sortSelect = document.getElementById('entrySortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            const sortedEntries = sortEntries(entriesToRender || [], sortSelect.value);
            renderEntriesList(sortedEntries);
        });
    }
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

// Handle search
async function handleSearch(event) {
    const query = event.target.value.toLowerCase().trim();
    const container = document.querySelector('.entries-container');
    
    if (!query) {
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
        const categories = await window.api.getCategories();
        
        // Search across all entries
        const allEntries = [];
        for (const category of categories) {
            const categoryEntries = await window.api.getEntries(category.id);
            allEntries.push(...categoryEntries);
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

            // Check if any field contains the search query
            return searchableFields.some(field => field.includes(query));
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
        container.innerHTML = `
            <div class="search-results">
                <h2><i class="fas fa-search"></i> Search Results for "${query}"</h2>
                ${Object.keys(groupedResults).length > 0 ? `
                    ${Object.entries(groupedResults).map(([categoryName, entries]) => `
                        <div class="search-category-group">
                            <h3><i class="fas fa-folder"></i> ${categoryName} (${entries.length})</h3>
                            <div class="search-entries-grid">
                                ${entries.map(entry => {
                                    // Highlight matching text in title and description
                                    const highlightedTitle = entry.title.replace(
                                        new RegExp(query, 'gi'),
                                        match => `<mark>${match}</mark>`
                                    );
                                    const highlightedDesc = entry.description?.replace(
                                        new RegExp(query, 'gi'),
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
                    const entryData = await window.api.getEntry(entryId);
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

// Populate category dropdown
async function populateCategoryDropdown() {
    try {
        const categorySelect = document.getElementById('category');
        const categories = await window.api.getCategories();
        
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
                        await window.api.deleteEntry(entry.id);
                        
                        // Reset window and input state
                        await resetWindowAndInputState();
                        
                        // Remove entry from UI
                        const entryElement = document.querySelector(`.entry[data-entry-id="${entry.id}"]`);
                        if (entryElement && document.body.contains(entryElement)) {
                            entryElement.remove();
                        }
                        
                        // Refresh the view
                        if (currentCategory) {
                            entries = await window.api.getEntries(currentCategory);
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
            const result = await window.api.save_file({
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
        const result = await window.api.exportData({
            includeFiles: true // Always include files for now - could make this configurable in settings
        });
        
        if (result && result.success) {
            // Update last merged date
            config.lastMerged = new Date().toISOString();
            await window.api.updateConfig(config);
            
            showNotification('Export completed successfully!', 'success');
        }
    } catch (error) {
        console.error('Error in export process:', error);
        let errorMessage = 'Failed to export data';
        
        // Provide more specific error messages
        if (error.code === 'EACCES') {
            errorMessage = 'Permission denied. Please choose a different location.';
        } else if (error.code === 'ENOSPC') {
            errorMessage = 'Not enough disk space for the export.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
    }
}

// Handle import
async function handleImport() {
    try {
        const result = await window.api.importData();
        
        if (result.cancelled) {
            // Import was cancelled by user, just return silently
            return;
        }
        
        if (result && result.success) {
            // Update last merged date
            config.lastMerged = new Date().toISOString();
            await window.api.updateConfig(config);
            
            showNotification('Import completed successfully!', 'success');
 
            // Refresh the view
            const categories = await window.api.getCategories();
            renderCategories(categories);
            if (currentCategory) {
                await loadEntries(currentCategory);
            } else {
                await renderDashboard();
            }
            
            // Show import summary if provided
            if (result.summary) {
                showNotification(
                    `Imported: ${result.summary.categories} categories, ` +
                    `${result.summary.entries} entries, ` +
                    `${result.summary.files || 0} files`,
                    'info',
                    8000 // Show for 8 seconds
                );
            }
        }
    } catch (error) {
        console.error('Error in import process:', error);
        let errorMessage = 'Failed to import data';
        
        // Provide more specific error messages
        if (error.code === 'EACCES') {
            errorMessage = 'Permission denied. Cannot access the import file.';
        } else if (error.code === 'INVALID_FORMAT') {
            errorMessage = 'Invalid import file format. Please select a valid export file.';
        } else if (error.code === 'DATABASE_ERROR') {
            errorMessage = 'Database error during import. Your data is unchanged.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
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
        const categories = await window.api.getCategories();
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
        const updatedCategories = await window.api.getCategories();
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
        const data = await window.api.getDashboardData();
        const container = document.querySelector('.entries-container');
        
        // Ensure data and its properties exist
        if (!data) {
            throw new Error('No dashboard data received');
        }

        // Initialize empty arrays if properties don't exist
        const favorites = data.favorites || [];
        window.favorites = favorites; // Make favorites accessible globally
        const recentlyUpdated = (data.recentEntries || []).slice(0, 5); // Limit to 5 entries
        const recentlyAdded = (data.recentlyAdded || []).slice(0, 5); // Limit to 5 entries
        
        container.innerHTML = `
            <div class="dashboard">
                <div class="dashboard-section favorites-section">
                    <h2><i class="fas fa-star"></i> Favorites</h2>
                    <div class="favorites-controls">
                        <span class="sort-label">Sort by:</span>
                        <select class="sort-select" id="favoritesSortSelect">
                            <option value="title">Title (A-Z)</option>
                            <option value="titleDesc">Title (Z-A)</option>
                            <option value="dateCreated">Date Created (Newest)</option>
                            <option value="dateCreatedAsc">Date Created (Oldest)</option>
                            <option value="dateModified">Last Modified (Newest)</option>
                            <option value="dateModifiedAsc">Last Modified (Oldest)</option>
                            <option value="rating">Rating (Highest)</option>
                            <option value="ratingAsc">Rating (Lowest)</option>
                        </select>
                    </div>
                    <div class="favorites-grid">
                        ${favorites.length > 0 ? 
                            sortEntries(favorites, 'title').map(entry => {
                                if (!entry) return '';
                                const createdDate = new Date(entry.created_at || Date.now());
                                const lastEditDate = new Date(entry.last_edit_at || entry.updated_at || Date.now());
                                const timeSinceEdit = timeSince(lastEditDate);

                                return `
                                    <div class="entry" data-entry-id="${entry.id}">
                                        <button class="favorite-btn active" title="Remove from favorites">
                                            <i class="fas fa-star"></i>
                                        </button>
                                        <div class="entry-header">
                                            <div class="entry-title">
                                                <h4>${entry.category_name || 'Entry'}</h4>
                                                <h3>${entry.title || 'Untitled Entry'}</h3>
                                            </div>
                                            <div class="entry-metadata">
                                                <span class="metadata-item" title="Created on ${createdDate.toLocaleDateString()}">
                                                    <i class="fas fa-calendar-plus"></i>
                                                    ${createdDate.toLocaleDateString()}
                                                </span>
                                                <span class="metadata-item" title="Last edited ${lastEditDate.toLocaleString()}">
                                                    <i class="fas fa-clock"></i>
                                                    ${timeSinceEdit}
                                                </span>
                                                <span class="metadata-item" title="Viewed ${entry.view_count || 0} times">
                                                    <i class="fas fa-eye"></i>
                                                    ${entry.view_count || 0}
                                                </span>
                                            </div>
                                        </div>
                                        <div class="entry-content">
                                            ${entry.description ? `
                                                <div class="entry-section">
                                                    <h4><i class="fas fa-align-left"></i> Description</h4>
                                                    <p>${entry.description}</p>
                                                </div>
                                            ` : ''}
                                            ${entry.wisdom ? `
                                                <div class="entry-section">
                                                    <h4><i class="fas fa-lightbulb"></i> Wisdom</h4>
                                                    <p>${entry.wisdom}</p>
                                                </div>
                                            ` : ''}
                                            ${(entry.files?.length > 0 || entry.file_path) ? `
                                                <div class="entry-section">
                                                    <h4><i class="fas fa-paperclip"></i> Files</h4>
                                                    <div class="files-list">
                                                        ${entry.files ? entry.files.map(file => `
                                                            <div class="file-attachment" title="Click to open file">
                                                                <i class="fas fa-file"></i>
                                                                <span class="file-name">${file?.name || file?.path?.split('/').pop() || 'Unknown file'}</span>
                                                                <div class="file-actions">
                                                                    <button class="download-btn" title="Download file">
                                                                        <i class="fas fa-download"></i>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        `).join('') : entry.file_path ? `
                                                            <div class="file-attachment" title="Click to open file">
                                                                <i class="fas fa-file"></i>
                                                                <span class="file-name">${entry.file_path.split('/').pop()}</span>
                                                                <div class="file-actions">
                                                                    <button class="download-btn" title="Download file">
                                                                        <i class="fas fa-download"></i>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ` : ''}
                                                    </div>
                                                </div>
                                            ` : ''}
                                        </div>
                                        <div class="entry-footer">
                                            <div class="rating-section">
                                                ${renderStars(entry.id, entry.rating || 0)}
                                            </div>
                                            ${entry.tags ? `
                                                <div class="tags">
                                                    ${entry.tags.split(',').map(tag => `<span class="tag" title="Filter by tag">${tag.trim()}</span>`).join('')}
                                                </div>
                                            ` : ''}
                                            <div class="entry-actions">
                                                <button class="edit-btn" data-entry-id="${entry.id}" title="Edit entry">
                                                    <i class="fas fa-edit"></i>
                                                    Edit
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('') :
                            '<p class="no-entries">No favorite entries yet. Click the star on any entry to add it to your favorites.</p>'
                        }
                    </div>
                </div>

                <div class="dashboard-recent-sections">
                    <div class="dashboard-section recent-section">
                        <h2><i class="fas fa-plus"></i> What's New</h2>
                        <div class="recent-list">
                            ${recentlyAdded.length > 0 ? `
                                <div class="recent-entries">
                                    ${recentlyAdded.map(entry => `
                                        <div class="recent-entry" data-entry-id="${entry.id}" data-category-id="${entry.category_id}">
                                            <div class="recent-entry-header">
                                                <div class="recent-entry-icon">
                                                    <i class="fas fa-${entry.files?.length ? 'file-alt' : 'sticky-note'}"></i>
                                                </div>
                                                <div class="recent-entry-info">
                                                    <h4>${entry.title || 'Untitled Entry'}</h4>
                                                    <span class="recent-entry-meta">
                                                        <i class="fas fa-folder"></i> ${entry.category_name || 'Uncategorized'}
                                                        <span class="dot">•</span>
                                                        <i class="fas fa-clock"></i> ${timeSince(new Date(entry.created_at || Date.now()))} ago
                                                    </span>
                                                </div>
                                                ${entry.is_favorite ? '<i class="fas fa-star favorite-indicator"></i>' : ''}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : '<p class="no-entries">No recently added entries</p>'}
                        </div>
                    </div>

                    <div class="dashboard-section recent-section">
                        <h2><i class="fas fa-clock"></i> Recently Updated</h2>
                        <div class="recent-list">
                            ${recentlyUpdated.length > 0 ? `
                                <div class="recent-entries">
                                    ${recentlyUpdated.map(entry => `
                                        <div class="recent-entry" data-entry-id="${entry.id}" data-category-id="${entry.category_id}">
                                            <div class="recent-entry-header">
                                                <div class="recent-entry-icon">
                                                    <i class="fas fa-${entry.files?.length ? 'file-alt' : 'sticky-note'}"></i>
                                                </div>
                                                <div class="recent-entry-info">
                                                    <h4>${entry.title || 'Untitled Entry'}</h4>
                                                    <span class="recent-entry-meta">
                                                        <i class="fas fa-folder"></i> ${entry.category_name || 'Uncategorized'}
                                                        <span class="dot">•</span>
                                                        <i class="fas fa-clock"></i> ${timeSince(new Date(entry.last_edit_at || entry.updated_at || Date.now()))} ago
                                                    </span>
                                                </div>
                                                ${entry.is_favorite ? '<i class="fas fa-star favorite-indicator"></i>' : ''}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : '<p class="no-entries">No recently updated entries</p>'}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add all necessary CSS styles
        if (!document.querySelector('#dashboard-styles')) {
            const dashboardStyles = document.createElement('style');
            dashboardStyles.id = 'dashboard-styles';
            dashboardStyles.textContent = `
                .dashboard {
                    display: flex;
                    flex-direction: column;
                    gap: 2rem;
                }

                .dashboard-recent-sections {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 2rem;
                    margin-top: 1rem;
                }

                .recent-section {
                    min-width: 0;
                    background: #fff;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    padding: 1.5rem;
                }

                .recent-section h2 {
                    margin: 0 0 1rem 0;
                    color: #2c3e50;
                    font-size: 1.2rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .recent-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .recent-entries {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .recent-entry {
                    padding: 0.75rem;
                    border-radius: 6px;
                    background: #f8f9fa;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .recent-entry:hover {
                    background: #e9ecef;
                    transform: translateY(-1px);
                }

                .recent-entry-header {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    position: relative;
                }

                .recent-entry-icon {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #e9ecef;
                    border-radius: 6px;
                    color: #495057;
                }

                .recent-entry-info {
                    flex: 1;
                    min-width: 0;
                }

                .recent-entry-info h4 {
                    margin: 0;
                    font-size: 0.95rem;
                    color: #212529;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .recent-entry-meta {
                    font-size: 0.8rem;
                    color: #6c757d;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-top: 0.25rem;
                }

                .dot {
                    font-size: 0.5rem;
                    color: #adb5bd;
                }

                .favorite-indicator {
                    color: #ffd700;
                    position: absolute;
                    right: 0.5rem;
                    top: 50%;
                    transform: translateY(-50%);
                }

                @media (max-width: 768px) {
                    .dashboard-recent-sections {
                        grid-template-columns: 1fr;
                    }
                }

                @keyframes highlight {
                    0% { background-color: rgba(52, 152, 219, 0.2); }
                    100% { background-color: white; }
                }

                @keyframes fadeOut {
                    from { opacity: 1; transform: scale(1); }
                    to { opacity: 0; transform: scale(0.95); }
                }
            `;
            document.head.appendChild(dashboardStyles);
        }

        // Add click handlers for recent entries
        container.querySelectorAll('.recent-entry').forEach(entry => {
            entry.addEventListener('click', async () => {
                const categoryId = entry.dataset.categoryId;
                const entryId = entry.dataset.entryId;
                
                // Update category selection
                currentCategory = categoryId;
                document.querySelectorAll('.category-item').forEach(item => {
                    item.classList.toggle('active', item.dataset.id === categoryId);
                });
                
                // Load entries for the category
                await loadEntries(categoryId);
                
                // Find and highlight the selected entry
                setTimeout(() => {
                    const targetEntry = document.querySelector(`.entry[data-entry-id="${entryId}"]`);
                    if (targetEntry) {
                        targetEntry.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        targetEntry.style.animation = 'highlight 2s';
                    }
                }, 100);
            });
        });

        // Add event handlers for entries
        container.querySelectorAll('.entry').forEach(entry => {
            if (!entry) return;
            const entryId = entry.dataset.entryId;
            if (!entryId) return;

            // Add click handler for favorite button
            const favoriteBtn = entry.querySelector('.favorite-btn');
            if (favoriteBtn) {
                favoriteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    if (favoriteBtn.disabled) {
                        return;
                    }

                    try {
                        // Disable the button while processing
                        favoriteBtn.disabled = true;

                        const result = await window.api.toggleFavorite(entry.id);
                        favoriteBtn.classList.toggle('active', result.isFavorite);
                        favoriteBtn.title = result.isFavorite ? 'Remove from favorites' : 'Add to favorites';
                        
                        // If removing from favorites and we're in the favorites section
                        const entryContainer = favoriteBtn.closest('.entry');
                        if (!result.isFavorite && entryContainer && entryContainer.closest('.favorites-grid')) {
                            // Remove the entry with animation
                            entryContainer.style.animation = 'fadeOut 0.3s';
                            setTimeout(() => {
                                if (document.body.contains(entryContainer)) {
                                    entryContainer.remove();
                                    
                                    // Check if we need to show "no entries" message
                                    const favoritesGrid = document.querySelector('.favorites-grid');
                                    if (favoritesGrid && !favoritesGrid.querySelector('.entry')) {
                                        favoritesGrid.innerHTML = '<p class="no-entries">No favorite entries yet. Click the star on any entry to add it to your favorites.</p>';
                                    }
                                }
                                // Clean overlays and pointer-events
                                forceClearOverlaysAndPointerEvents();
                                // Focus the search input
                                const searchInput = document.querySelector('#search');
                                if (searchInput) {
                                    searchInput.focus();
                                }
                            }, 300);
                        }
                        
                        // Re-enable the button
                        favoriteBtn.disabled = false;
                    } catch (error) {
                        console.error('Error toggling favorite:', error);
                        showNotification('Error updating favorites', 'error');
                        // Re-enable the button on error
                        favoriteBtn.disabled = false;
                    }
                });
            }

            // Add click handler for edit button
            const editBtn = entry.querySelector('.edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        // Get the entry data directly from the entries array
                        const entryId = editBtn.dataset.entryId;
                        const entryToEdit = entries.find(e => e.id === entryId) || entry;
                        
                        if (!entryToEdit) {
                            console.error('Could not find entry data for ID:', entryId);
                            showNotification('Error loading entry data', 'error');
                            return;
                        }

                        // Show the modal with the entry data
                        showModal(entryToEdit);
                    } catch (error) {
                        console.error('Error opening edit modal:', error);
                        showNotification('Error opening edit modal', 'error');
                    }
                });
            }

            // Add handlers for file attachments
            if ((entry.files && entry.files.length > 0) || entry.file_path) {
                const fileAttachments = entry.querySelectorAll('.file-attachment');
                fileAttachments.forEach((fileAttachment, index) => {
                    const file = entry.files ? entry.files[index] : { path: entry.file_path };
                    
                    // Open file on click
                    fileAttachment.addEventListener('click', async (e) => {
                        if (!e.target.closest('.download-btn')) {
                            try {
                                await window.api.openFile(file.path);
                                // Increment view count when file is opened
                                await window.api.incrementViewCount(entry.id);
                                // Update the view count display
                                const viewCountElement = entry.querySelector('.metadata-item[title^="Viewed"]');
                                if (viewCountElement) {
                                    const currentCount = parseInt(viewCountElement.textContent) || 0;
                                    viewCountElement.textContent = currentCount + 1;
                                    viewCountElement.title = `Viewed ${currentCount + 1} times`;
                                }
                            } catch (error) {
                                console.error('Error opening file:', error);
                                showNotification('Failed to open file', 'error');
                            }
                        }
                    });

                    // Download file on download button click
                    const downloadBtn = fileAttachment.querySelector('.download-btn');
                    if (downloadBtn) {
                        downloadBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            try {
                                await window.api.downloadFile(file.path);
                                showNotification('File download started', 'success');
                            } catch (error) {
                                console.error('Error downloading file:', error);
                                showNotification('Failed to download file', 'error');
                            }
                        });
                    }
                });
            }

            // Add click handlers for star ratings
            const stars = entry.querySelectorAll('.star');
            stars.forEach(star => {
                star.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const rating = parseInt(star.dataset.rating);
                    const entryId = star.closest('.rating-stars').dataset.entryId;
                    
                    try {
                        await window.api.addRating({
                            entry_id: entryId,
                            rating: rating
                        });
                        
                        // Update the stars visually
                        const allStars = star.closest('.rating-stars').querySelectorAll('.star');
                        allStars.forEach((s, index) => {
                            s.classList.toggle('active', index < rating);
                        });
                        
                        showNotification('Rating saved successfully', 'success');
                    } catch (error) {
                        console.error('Error saving rating:', error);
                        showNotification('Error saving rating', 'error');
                    }
                });
            });
        });

        // Add sort change listener for favorites
        const favoritesSortSelect = document.getElementById('favoritesSortSelect');
        if (favoritesSortSelect) {
            favoritesSortSelect.addEventListener('change', () => {
                const sortedFavorites = sortEntries(favorites, favoritesSortSelect.value);
                const favoritesGrid = document.querySelector('.favorites-grid');
                if (favoritesGrid) {
                    favoritesGrid.innerHTML = sortedFavorites.length > 0 ? 
                        sortedFavorites.map(entry => {
                            if (!entry) return '';
                            const createdDate = new Date(entry.created_at || Date.now());
                            const lastEditDate = new Date(entry.last_edit_at || entry.updated_at || Date.now());
                            const timeSinceEdit = timeSince(lastEditDate);

                            return `
                                <div class="entry" data-entry-id="${entry.id}">
                                    <button class="favorite-btn active" title="Remove from favorites">
                                        <i class="fas fa-star"></i>
                                    </button>
                                    <div class="entry-header">
                                        <div class="entry-title">
                                            <h4>${entry.category_name || 'Entry'}</h4>
                                            <h3>${entry.title || 'Untitled Entry'}</h3>
                                        </div>
                                        <div class="entry-metadata">
                                            <span class="metadata-item" title="Created on ${createdDate.toLocaleDateString()}">
                                                <i class="fas fa-calendar-plus"></i>
                                                ${createdDate.toLocaleDateString()}
                                            </span>
                                            <span class="metadata-item" title="Last edited ${lastEditDate.toLocaleString()}">
                                                <i class="fas fa-clock"></i>
                                                ${timeSinceEdit}
                                            </span>
                                            <span class="metadata-item" title="Viewed ${entry.view_count || 0} times">
                                                <i class="fas fa-eye"></i>
                                                ${entry.view_count || 0}
                                            </span>
                                        </div>
                                    </div>
                                    <div class="entry-content">
                                        ${entry.description ? `
                                            <div class="entry-section">
                                                <h4><i class="fas fa-align-left"></i> Description</h4>
                                                <p>${entry.description}</p>
                                            </div>
                                        ` : ''}
                                        ${entry.wisdom ? `
                                            <div class="entry-section">
                                                <h4><i class="fas fa-lightbulb"></i> Wisdom</h4>
                                                <p>${entry.wisdom}</p>
                                            </div>
                                        ` : ''}
                                        ${(entry.files?.length > 0 || entry.file_path) ? `
                                            <div class="entry-section">
                                                <h4><i class="fas fa-paperclip"></i> Files</h4>
                                                <div class="files-list">
                                                    ${entry.files ? entry.files.map(file => `
                                                        <div class="file-attachment" title="Click to open file">
                                                            <i class="fas fa-file"></i>
                                                            <span class="file-name">${file?.name || file?.path?.split('/').pop() || 'Unknown file'}</span>
                                                            <div class="file-actions">
                                                                <button class="download-btn" title="Download file">
                                                                    <i class="fas fa-download"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    `).join('') : entry.file_path ? `
                                                        <div class="file-attachment" title="Click to open file">
                                                            <i class="fas fa-file"></i>
                                                            <span class="file-name">${entry.file_path.split('/').pop()}</span>
                                                            <div class="file-actions">
                                                                <button class="download-btn" title="Download file">
                                                                    <i class="fas fa-download"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ` : ''}
                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div class="entry-footer">
                                        <div class="rating-section">
                                            ${renderStars(entry.id, entry.rating || 0)}
                                        </div>
                                        ${entry.tags ? `
                                            <div class="tags">
                                                ${entry.tags.split(',').map(tag => `<span class="tag" title="Filter by tag">${tag.trim()}</span>`).join('')}
                                            </div>
                                        ` : ''}
                                        <div class="entry-actions">
                                            <button class="edit-btn" data-entry-id="${entry.id}" title="Edit entry">
                                                <i class="fas fa-edit"></i>
                                                Edit
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('') :
                        '<p class="no-entries">No favorite entries yet. Click the star on any entry to add it to your favorites.</p>';
                }
            });
        }
    } catch (error) {
        console.error('Error rendering dashboard:', error);
        showNotification('Error loading dashboard', 'error');
        
        // Show error state in the container
        const container = document.querySelector('.entries-container');
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Error Loading Dashboard</h3>
                    <p>There was a problem loading the dashboard. Please try refreshing the page.</p>
                    <button onclick="window.location.reload()">Refresh Page</button>
                    <details>
                        <summary>Error Details (for debugging)</summary>
                        <pre>${error.message}</pre>
                    </details>
                </div>
            `;
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load config
        config = await window.api.getConfig();
        updateDeviceInfo();
        
        // Set up event listeners
        setupEventListeners();
        
        // Initialize modal
        initializeModal();
        
        // Load categories for sidebar
        const categories = await window.api.getCategories();
        renderCategories(categories);
        
        // Start with dashboard view
        await renderDashboard();
        
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
    
    const name = document.getElementById('categoryName').value.trim();
    const id = document.getElementById('categoryId').value;
    const iconElement = document.querySelector('.icon-option.selected');
    const colorElement = document.querySelector('.color-option.selected');
    
    if (!name) {
        showNotification('Please enter a category name', 'error');
        return;
    }

    try {
        const categoryData = {
            name,
            icon: iconElement ? iconElement.dataset.icon : 'folder',
            color: colorElement ? colorElement.dataset.color : '#3498db'
        };

        if (id) {
            // Update existing category
            await window.api.updateCategory({
                id,
                ...categoryData
            });
        } else {
            // Add new category
            await window.api.addCategory(categoryData);
        }
        
        await refreshCategories();
        hideCategoryModal();
        showNotification(`Category ${id ? 'updated' : 'created'} successfully`, 'success');
    } catch (error) {
        console.error('Error saving category:', error);
        showNotification('Error saving category', 'error');
    }
}

async function deleteCategory() {
    try {
        const categoryId = document.getElementById('categoryId')?.value;
        if (!categoryId) {
            console.error('No category ID found');
            return;
        }

        if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
            return;
        }

        // Check if category has entries
        const entries = await window.api.getEntries();
        const hasEntries = entries.some(entry => entry.categoryId === categoryId);
        
        if (hasEntries) {
            const moveEntries = confirm('This category contains entries. Would you like to move them to the default category?');
            if (moveEntries) {
                // Move entries to default category
                const updatedEntries = entries.map(entry => 
                    entry.categoryId === categoryId 
                        ? { ...entry, categoryId: null }
                        : entry
                );
                await window.api.saveEntries(updatedEntries);
            } else {
                // Delete entries in this category
                const filteredEntries = entries.filter(entry => entry.categoryId !== categoryId);
                await window.api.saveEntries(filteredEntries);
            }
        }

        // Remove category
        categories = categories.filter(cat => cat.id !== categoryId);
        await window.api.saveCategories(categories);
        
        // Close the modal first
        const modal = document.getElementById('category-settings-modal');
        if (modal) {
            modal.style.display = 'none';
        }

        // Clear any existing overlays
        document.querySelectorAll('.modal-backdrop, .modal-overlay').forEach(el => el.remove());
        
        // Reset document and body states
        document.documentElement.style.pointerEvents = 'auto';
        document.body.style.pointerEvents = 'auto';
        document.body.style.overflow = 'auto';
        document.body.classList.remove('modal-open');
        
        // Re-enable all inputs
        document.querySelectorAll('input, textarea').forEach(input => {
            input.style.pointerEvents = 'auto';
            input.style.userSelect = 'text';
            input.disabled = false;
        });

        // Remove any event listeners that might be blocking
        document.removeEventListener('keydown', handleKeyDown, true);
        document.removeEventListener('keyup', handleKeyUp, true);
        document.removeEventListener('keypress', handleKeyPress, true);
        document.removeEventListener('click', handleClick, true);
        
        // Re-add normal event listeners
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        document.addEventListener('keypress', handleKeyPress);
        document.addEventListener('click', handleClick);

        // Clear any text selection
        if (window.getSelection) {
            window.getSelection().removeAllRanges();
        }

        // Force a DOM reflow
        void document.body.offsetHeight;
        
        // Refresh categories
        await refreshCategories();
        
        // Focus the search input
        const searchInput = document.querySelector('#search');
        if (searchInput) {
            // Clone and replace the search input to ensure clean state
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                newSearchInput.focus();
                // Trigger a click to ensure focus is properly set
                newSearchInput.click();
            }, 100);
        }

        // Show success notification
        showNotification('Category deleted successfully', 'success');

    } catch (error) {
        console.error('Error deleting category:', error);
        showNotification('Failed to delete category. Please try again.', 'error');
        
        // Ensure cleanup even on error
        document.documentElement.style.pointerEvents = 'auto';
        document.body.style.pointerEvents = 'auto';
        const modal = document.getElementById('category-settings-modal');
        if (modal) {
            modal.style.display = 'none';
        }

        // Diagnostic logging: overlays and pointer-events
        console.log('--- DIAGNOSTIC LOGGING AFTER CATEGORY DELETE ---');
        // Log overlays still present
        const overlays = Array.from(document.querySelectorAll('[style*="pointer-events: none"], .modal-backdrop, .modal-overlay'));
        console.log('Overlays or elements with pointer-events: none:', overlays);
        // Log computed styles for body and html
        const bodyStyles = window.getComputedStyle(document.body);
        const htmlStyles = window.getComputedStyle(document.documentElement);
        console.log('BODY pointer-events:', bodyStyles.pointerEvents, 'user-select:', bodyStyles.userSelect);
        console.log('HTML pointer-events:', htmlStyles.pointerEvents, 'user-select:', htmlStyles.userSelect);
        // Log currently focused element
        console.log('Currently focused element:', document.activeElement);
        // Log all disabled inputs
        const disabledInputs = Array.from(document.querySelectorAll('input:disabled, textarea:disabled'));
        console.log('Disabled inputs:', disabledInputs);
    }
}

async function hideCategoryModal() {
    const modal = document.getElementById('categoryModal');
    modal.style.display = 'none';
}

async function loadCategories() {
    try {
        categories = await window.api.getCategories();
        updateCategorySelects();
    } catch (error) {
        console.error('Error loading categories:', error);
        categories = [];
    }
}

function updateCategorySelects() {
    const categorySelects = document.querySelectorAll('.category-select');
    categorySelects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Select Category</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            select.appendChild(option);
        });
        if (currentValue) {
            select.value = currentValue;
        }
    });
}

// Event Listeners
document.getElementById('categoryForm').addEventListener('submit', handleCategorySubmit);
document.querySelector('#categoryModal .close').addEventListener('click', hideCategoryModal);

// Initialize categories on load
loadCategories();

// Listen for the show-category-settings event from the main process
window.api.receive('show-category-settings', () => {
    showCategorySettingsModal();
});

function showCategorySettingsModal() {
    const modal = document.getElementById('category-settings-modal');
    modal.style.display = 'block';
    loadCategoriesList();
    resetCategoryForm();
}

async function loadCategoriesList() {
    try {
        // Get fresh categories from the database
        categories = await window.api.getCategories();
        
        const categoriesList = document.querySelector('#category-settings-modal .categories-list');
        categoriesList.innerHTML = `
            <div class="add-category-button">
                <i class="fas fa-plus"></i>
                Add New Category
            </div>
        `;

        // Add click handler for the add category button
        const addButton = categoriesList.querySelector('.add-category-button');
        addButton.addEventListener('click', () => {
            startNewCategory();
        });

        if (categories && categories.length > 0) {
            categories.forEach(category => {
                const item = document.createElement('div');
                item.className = 'category-list-item';
                item.dataset.id = category.id;
                item.innerHTML = `
                    <i class="fas fa-${category.icon || 'folder'}" style="color: ${category.color || '#3498db'}"></i>
                    <span>${category.name}</span>
                `;
                
                item.addEventListener('click', () => selectCategory(category));
                categoriesList.appendChild(item);
            });
        }
    } catch (error) {
        console.error('Error loading categories list:', error);
        showNotification('Error loading categories', 'error');
    }
}

function selectCategory(category) {
    selectedCategoryId = category.id;
    
    // Update selected state in list
    document.querySelectorAll('.category-list-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.id === category.id);
    });
    
    // Populate form with the correct ID
    document.getElementById('category-name').value = category.name;
    document.getElementById('categoryId').value = category.id;
    
    // Update icon selection
    document.querySelectorAll('.icon-option').forEach(option => {
        option.classList.toggle('selected', option.dataset.icon === (category.icon || 'folder'));
    });
    
    // Update color selection
    document.querySelectorAll('.color-option').forEach(option => {
        option.classList.toggle('selected', option.dataset.color === (category.color || '#3498db'));
    });
    
    // Show delete button
    document.getElementById('deleteCategoryBtn').style.display = 'block';
}

function startNewCategory() {
    selectedCategoryId = null;
    resetCategoryForm();
    document.getElementById('categoryName').focus();
}

function resetCategoryForm() {
    try {
        const form = document.getElementById('category-settings-form');
        if (!form) {
            console.error('Category settings form not found');
            return;
        }

        // Reset the form
        form.reset();
        
        // Reset category ID
        const categoryIdInput = document.getElementById('categoryId');
        if (categoryIdInput) {
            categoryIdInput.value = '';
        }

        // Hide delete button
        const deleteBtn = document.getElementById('deleteCategoryBtn');
        if (deleteBtn) {
            deleteBtn.style.display = 'none';
        }
        
        // Reset selections with null checks
        document.querySelectorAll('.category-list-item').forEach(item => {
            if (item) {
                item.classList.remove('selected');
            }
        });
        
        // Select default icon and color with null checks
        const defaultIconOption = document.querySelector('.icon-option[data-icon="folder"]');
        if (defaultIconOption) {
            document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
            defaultIconOption.classList.add('selected');
        }

        const defaultColorOption = document.querySelector('.color-option[data-color="#3498db"]');
        if (defaultColorOption) {
            document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
            defaultColorOption.classList.add('selected');
        }
    } catch (error) {
        console.error('Error in resetCategoryForm:', error);
    }
}

// Event Listeners for Category Settings
document.getElementById('category-settings-modal').querySelector('.close-modal').addEventListener('click', () => {
    document.getElementById('category-settings-modal').style.display = 'none';
});

document.getElementById('cancelCategoryEdit').addEventListener('click', () => {
    resetCategoryForm();
});

document.getElementById('deleteCategoryBtn').addEventListener('click', async () => {
    if (!selectedCategoryId) return;
    
    if (confirm('Are you sure you want to delete this category? All entries in this category will be moved to the default category.')) {
        try {
            await window.api.deleteCategory(selectedCategoryId);
            await refreshCategories();
            loadCategoriesList();
            resetCategoryForm();
            showNotification('Category deleted successfully', 'success');
            await resetWindowAndInputState();
        } catch (error) {
            console.error('Error deleting category:', error);
            showNotification('Error deleting category', 'error');
        }
    }
});

document.getElementById('category-settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get the name from the input field - make sure we're using the correct ID
    const nameInput = document.querySelector('#category-settings-modal input[type="text"]');
    const name = nameInput ? nameInput.value.trim() : '';
    const id = document.getElementById('categoryId')?.value;
    
    // Get selected icon and color from the modal
    const selectedIcon = document.querySelector('#category-settings-modal .icon-option.selected');
    const selectedColor = document.querySelector('#category-settings-modal .color-option.selected');
    
    const icon = selectedIcon?.dataset.icon || 'folder';
    const color = selectedColor?.dataset.color || '#3498db';
    
    if (!name) {
        showNotification('Please enter a category name', 'error');
        return;
    }
    
    try {
        const categoryData = {
            name,
            icon,
            color
        };

        if (id) {
            // Update existing category
            await window.api.updateCategory({
                id,
                ...categoryData
            });
        } else {
            // Add new category
            await window.api.addCategory(categoryData);
        }
        
        // Refresh the categories list and UI
        await refreshCategories();
        await loadCategoriesList();
        resetCategoryForm();
        showNotification(`Category ${id ? 'updated' : 'created'} successfully`, 'success');
    } catch (error) {
        console.error('Error saving category:', error);
        showNotification('Error saving category', 'error');
    }
});

// Icon and Color Picker Event Listeners
document.querySelectorAll('.icon-option').forEach(option => {
    option.addEventListener('click', () => {
        document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
    });
});

document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
    });
});

// Add the handleEntrySubmit function
async function handleEntrySubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('title').value.trim();
    const categoryId = document.getElementById('category').value;
    if (!title || !categoryId) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    try {
        // Combine current and pending files
        const files = [...currentFiles, ...pendingFiles];
        
        const entry = {
            id: currentEntryId,
            title: title,
            description: document.getElementById('description').value,
            wisdom: document.getElementById('wisdom').value,
            categoryId: categoryId,
            files: files,
            tags: document.getElementById('tags').value
        };
        
        if (currentEntryId) {
            await window.api.updateEntry(entry);
        } else {
            await window.api.addEntry(entry);
        }
        
        // Close the modal first
        entryModal.style.display = 'none';
        
        // Reload entries for the current category
        if (currentCategory) {
            entries = await window.api.getEntries(currentCategory);
            renderEntries(entries);
        } else {
            // If no category is selected, set it to the one we just used
            currentCategory = categoryId;
            entries = await window.api.getEntries(categoryId);
            renderEntries(entries);
            
            // Update active state in category list
            document.querySelectorAll('.category-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.id === categoryId) {
                    item.classList.add('active');
                }
            });
        }
        
        // Refresh categories to update counts
        await refreshCategories();
        
        showNotification('Entry saved successfully', 'success');
    } catch (error) {
        console.error('Error saving entry:', error);
        showNotification(`Error saving entry: ${error.message}`, 'error');
    }
}

// Create an entry element
function createEntryElement(entry) {
    const entryElement = document.createElement('div');
    entryElement.className = 'entry';
    entryElement.dataset.entryId = entry.id;
    
    // Format dates
    const createdDate = new Date(entry.created_at);
    const lastEditDate = new Date(entry.last_edit_at || entry.updated_at);
    const timeSinceEdit = timeSince(lastEditDate);
    
    // Create the entry content
    entryElement.innerHTML = `
        <button class="favorite-btn ${entry.is_favorite ? 'active' : ''}" title="Toggle favorite">
            <i class="fas fa-star"></i>
        </button>
        <div class="entry-header">
            <div class="entry-title">
                <h4>${entry.category_name || 'Entry'}</h4>
                <h3>${entry.title}</h3>
            </div>
            <div class="entry-metadata">
                <span class="metadata-item" title="Created on ${createdDate.toLocaleDateString()}">
                    <i class="fas fa-calendar-plus"></i>
                    ${createdDate.toLocaleDateString()}
                </span>
                <span class="metadata-item" title="Last edited ${lastEditDate.toLocaleString()}">
                    <i class="fas fa-clock"></i>
                    ${timeSinceEdit}
                </span>
                <span class="metadata-item" title="Viewed ${entry.view_count || 0} times">
                    <i class="fas fa-eye"></i>
                    ${entry.view_count || 0}
                </span>
            </div>
        </div>
        <div class="entry-content">
            ${entry.description ? `
                <div class="entry-section">
                    <h4><i class="fas fa-align-left"></i> Description</h4>
                    <p>${entry.description}</p>
                </div>
            ` : ''}
            ${entry.wisdom ? `
                <div class="entry-section">
                    <h4><i class="fas fa-lightbulb"></i> Wisdom</h4>
                    <p>${entry.wisdom}</p>
                </div>
            ` : ''}
            ${(entry.files && entry.files.length > 0) || entry.file_path ? `
                <div class="entry-section">
                    <h4><i class="fas fa-paperclip"></i> Files</h4>
                    <div class="files-list">
                        ${entry.files ? entry.files.map(file => `
                            <div class="file-attachment" title="Click to open file">
                                <i class="fas fa-file"></i>
                                <span class="file-name">${file.name || file.path.split('/').pop()}</span>
                                <div class="file-actions">
                                    <button class="download-btn" title="Download file">
                                        <i class="fas fa-download"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('') : entry.file_path ? `
                            <div class="file-attachment" title="Click to open file">
                                <i class="fas fa-file"></i>
                                <span class="file-name">${entry.file_path.split('/').pop()}</span>
                                <div class="file-actions">
                                    <button class="download-btn" title="Download file">
                                        <i class="fas fa-download"></i>
                                    </button>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
        </div>
        <div class="entry-footer">
            <div class="rating-section">
                ${renderStars(entry.id, entry.rating || 0)}
            </div>
            ${entry.tags ? `
                <div class="tags">
                    ${entry.tags.split(',').map(tag => `<span class="tag" title="Filter by tag">${tag.trim()}</span>`).join('')}
                </div>
            ` : ''}
            <div class="entry-actions">
                <button class="edit-btn" data-entry-id="${entry.id}" title="Edit entry">
                    <i class="fas fa-edit"></i>
                    Edit
                </button>
            </div>
        </div>
    `;

    // Add event listeners for the entry card
    
    // Add click handler for favorite button
    const favoriteBtn = entryElement.querySelector('.favorite-btn');
    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();

            if (favoriteBtn.disabled) {
                return;
            }

            try {
                // Disable the button while processing
                favoriteBtn.disabled = true;

                const result = await window.api.toggleFavorite(entry.id);
                favoriteBtn.classList.toggle('active', result.isFavorite);
                favoriteBtn.title = result.isFavorite ? 'Remove from favorites' : 'Add to favorites';
                
                // If removing from favorites and we're in the favorites section
                const entryContainer = favoriteBtn.closest('.entry');
                if (!result.isFavorite && entryContainer && entryContainer.closest('.favorites-grid')) {
                    // Remove the entry with animation
                    entryContainer.style.animation = 'fadeOut 0.3s';
                    setTimeout(() => {
                        if (document.body.contains(entryContainer)) {
                            entryContainer.remove();
                            
                            // Check if we need to show "no entries" message
                            const favoritesGrid = document.querySelector('.favorites-grid');
                            if (favoritesGrid && !favoritesGrid.querySelector('.entry')) {
                                favoritesGrid.innerHTML = '<p class="no-entries">No favorite entries yet. Click the star on any entry to add it to your favorites.</p>';
                            }
                        }
                        // Clean overlays and pointer-events
                        forceClearOverlaysAndPointerEvents();
                        // Focus the search input
                        const searchInput = document.querySelector('#search');
                        if (searchInput) {
                            searchInput.focus();
                        }
                    }, 300);
                }
                
                // Re-enable the button
                favoriteBtn.disabled = false;
            } catch (error) {
                console.error('Error toggling favorite:', error);
                showNotification('Error updating favorites', 'error');
                // Re-enable the button on error
                favoriteBtn.disabled = false;
            }
        });
    }

    // Add click handler for edit button
    const editBtn = entryElement.querySelector('.edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                // Get the entry data directly from the entries array
                const entryId = editBtn.dataset.entryId;
                const entryToEdit = entries.find(e => e.id === entryId) || entry;
                
                if (!entryToEdit) {
                    console.error('Could not find entry data for ID:', entryId);
                    showNotification('Error loading entry data', 'error');
                    return;
                }

                // Show the modal with the entry data
                showModal(entryToEdit);
            } catch (error) {
                console.error('Error opening edit modal:', error);
                showNotification('Error opening edit modal', 'error');
            }
        });
    }

    // Add handlers for file attachments
    if ((entry.files && entry.files.length > 0) || entry.file_path) {
        const fileAttachments = entryElement.querySelectorAll('.file-attachment');
        fileAttachments.forEach((fileAttachment, index) => {
            const file = entry.files ? entry.files[index] : { path: entry.file_path };
            
            // Open file on click
            fileAttachment.addEventListener('click', async (e) => {
                if (!e.target.closest('.download-btn')) {
                    try {
                        await window.api.openFile(file.path);
                        // Increment view count when file is opened
                        await window.api.incrementViewCount(entry.id);
                        // Update the view count display
                        const viewCountElement = entryElement.querySelector('.metadata-item[title^="Viewed"]');
                        if (viewCountElement) {
                            const currentCount = parseInt(viewCountElement.textContent) || 0;
                            viewCountElement.textContent = currentCount + 1;
                            viewCountElement.title = `Viewed ${currentCount + 1} times`;
                        }
                    } catch (error) {
                        console.error('Error opening file:', error);
                        showNotification('Failed to open file', 'error');
                    }
                }
            });

            // Download file on download button click
            const downloadBtn = fileAttachment.querySelector('.download-btn');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        await window.api.downloadFile(file.path);
                        showNotification('File download started', 'success');
                    } catch (error) {
                        console.error('Error downloading file:', error);
                        showNotification('Failed to download file', 'error');
                    }
                });
            }
        });
    }

    // Add click handlers for star ratings
    const stars = entryElement.querySelectorAll('.star');
    stars.forEach(star => {
        star.addEventListener('click', async (e) => {
            e.stopPropagation();
            const rating = parseInt(star.dataset.rating);
            const entryId = star.closest('.rating-stars').dataset.entryId;
            
            try {
                await window.api.addRating({
                    entry_id: entryId,
                    rating: rating
                });
                
                // Update the stars visually
                const allStars = star.closest('.rating-stars').querySelectorAll('.star');
                allStars.forEach((s, index) => {
                    s.classList.toggle('active', index < rating);
                });
                
                showNotification('Rating saved successfully', 'success');
            } catch (error) {
                console.error('Error saving rating:', error);
                showNotification('Error saving rating', 'error');
            }
        });
    });

    return entryElement;
}

// Add clearSearch function
async function clearSearch() {
    searchInput.value = '';
    searchClearBtn.classList.remove('visible');
    if (!currentCategory) {
        await renderDashboard();
    } else {
        await loadEntries(currentCategory);
    }
}

// Utility function to clear overlays and pointer-events
function forceClearOverlaysAndPointerEvents() {
    // Remove any modal overlays or backdrops
    document.querySelectorAll('.modal-backdrop, .modal-overlay').forEach(el => el.remove());
    
    // Remove modal-open class and any inline styles from body
    document.body.className = document.body.className.replace(/\bmodal-open\b/, '');
    document.body.style.removeProperty('pointer-events');
    document.body.style.removeProperty('overflow');
    
    // Reset document element styles
    document.documentElement.style.removeProperty('pointer-events');
    document.documentElement.style.removeProperty('overflow');
    
    // Remove any capturing event listeners
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('keyup', handleKeyUp, true);
    document.removeEventListener('keypress', handleKeyPress, true);
    document.removeEventListener('click', handleClick, true);
    
    // Re-add normal event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('keypress', handleKeyPress);
    document.addEventListener('click', handleClick);
    
    // Reset all input elements
    document.querySelectorAll('input, textarea').forEach(input => {
        input.style.removeProperty('pointer-events');
        input.style.removeProperty('user-select');
        input.disabled = false;
    });
}

// Add this new function near the top with other utility functions
function forceWindowRefocus() {
    // Force window blur and refocus
    window.api.send('force-window-refresh');
    
    // Reset all input-related styles
    document.querySelectorAll('input, textarea').forEach(input => {
        input.style.pointerEvents = 'auto';
        input.style.userSelect = 'text';
        input.disabled = false;
    });
    
    // Reset document-level event handling
    document.body.style.pointerEvents = 'auto';
    document.documentElement.style.pointerEvents = 'auto';
    
    // Clear any selections
    window.getSelection().removeAllRanges();
    
    // Reset focus handling
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.blur();
    
    // Force a repaint
    document.body.style.transform = 'translateZ(0)';
    void document.body.offsetHeight;
    document.body.style.transform = '';
}

// Add this new function near the top with other utility functions
function resetInputState() {
    // Reset all input elements
    document.querySelectorAll('input, textarea').forEach(input => {
        input.style.pointerEvents = 'auto';
        input.style.userSelect = 'text';
        input.disabled = false;
    });
    
    // Reset any selected text
    if (window.getSelection) {
        window.getSelection().removeAllRanges();
    }
    
    // Reset document state
    document.body.style.pointerEvents = 'auto';
    document.documentElement.style.pointerEvents = 'auto';
    
    // Force a small DOM reflow without visual changes
    void document.body.offsetHeight;
}

// Add these functions at the top level of the file, near other utility functions
function handleKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        e.target.style.pointerEvents = 'auto';
        e.target.style.userSelect = 'text';
    }
}

function handleKeyUp(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        e.target.style.pointerEvents = 'auto';
        e.target.style.userSelect = 'text';
    }
}

function handleKeyPress(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        e.target.style.pointerEvents = 'auto';
        e.target.style.userSelect = 'text';
    }
}

// Add a click handler function
function handleClick(e) {
    // If clicking on an input or textarea, ensure it's enabled
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        e.target.style.removeProperty('pointer-events');
        e.target.style.removeProperty('user-select');
        e.target.disabled = false;
    }
}

// Add this function at the top level
async function resetWindowAndInputState() {
    try {
        // First try the soft reset
        await window.api.invoke('reset-window-state');
        
        // Remove any modal-related classes and styles
        document.body.className = document.body.className
            .split(' ')
            .filter(cls => !cls.includes('modal'))
            .join(' ');
            
        // Reset all input elements
        document.querySelectorAll('input, textarea').forEach(input => {
            const newInput = input.cloneNode(true);
            newInput.value = input.value; // Preserve the value
            input.parentNode.replaceChild(newInput, input);
        });
        
        // Reset event listeners
        document.removeEventListener('keydown', handleKeyDown, true);
        document.removeEventListener('keyup', handleKeyUp, true);
        document.removeEventListener('keypress', handleKeyPress, true);
        
        // Re-add event listeners normally
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        document.addEventListener('keypress', handleKeyPress);
        
        // Clear any selections
        if (window.getSelection) {
            window.getSelection().removeAllRanges();
        }
        
        // Reset focus handling
        document.activeElement?.blur();
        
    } catch (error) {
        console.error('Error resetting window state:', error);
        // If soft reset fails, try hard reset
        try {
            await window.api.invoke('force-input-reset');
        } catch (innerError) {
            console.error('Error forcing input reset:', innerError);
        }
    }
}

// Add this utility function near the top of the file
function restoreInputAndFocusState() {
    // Clear any existing overlays
    document.querySelectorAll('.modal-backdrop, .modal-overlay').forEach(el => el.remove());
    // Reset document and body states
    document.documentElement.style.pointerEvents = 'auto';
    document.body.style.pointerEvents = 'auto';
    document.body.style.overflow = 'auto';
    document.body.classList.remove('modal-open');
    // Re-enable all inputs
    document.querySelectorAll('input, textarea').forEach(input => {
        input.style.pointerEvents = 'auto';
        input.style.userSelect = 'text';
        input.disabled = false;
    });
    // Remove any event listeners that might be blocking
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('keyup', handleKeyUp, true);
    document.removeEventListener('keypress', handleKeyPress, true);
    document.removeEventListener('click', handleClick, true);
    // Re-add normal event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('keypress', handleKeyPress);
    document.addEventListener('click', handleClick);
    // Clear any text selection
    if (window.getSelection) {
        window.getSelection().removeAllRanges();
    }
    // Force a DOM reflow
    void document.body.offsetHeight;
    // Focus and select the search input
    const searchInput = document.querySelector('#search');
    if (searchInput) {
        searchInput.focus();
        searchInput.select();
    }
}