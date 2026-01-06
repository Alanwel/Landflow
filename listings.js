// Enhanced Listings Page Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initial state
    let currentView = 'grid';
    let currentSort = 'newest';
    let currentFilters = {
        type: 'all',
        minPrice: null,
        maxPrice: null,
        minAcres: null,
        maxAcres: null
    };
    
    // DOM Elements
    const listingsContainer = document.getElementById('listingsContainer');
    const listingCount = document.getElementById('listingCount');
    const noResults = document.getElementById('noResults');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    // Initialize
    displayListings();
    
    // View Toggle
    document.querySelectorAll('.view-toggle').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.view-toggle').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentView = this.id === 'gridView' ? 'grid' : 'list';
            displayListings();
        });
    });
    
    // Sort Select
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            currentSort = this.value;
            displayListings();
        });
    }
    
    // Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilters.type = this.dataset.type;
            displayListings();
        });
    });
    
    // Apply Filters Button
    const applyFiltersBtn = document.getElementById('applyFilters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', function() {
            currentFilters.minPrice = document.getElementById('minPrice').value || null;
            currentFilters.maxPrice = document.getElementById('maxPrice').value || null;
            currentFilters.minAcres = document.getElementById('minAcres').value || null;
            currentFilters.maxAcres = document.getElementById('maxAcres').value || null;
            displayListings();
        });
    }
    
    // Reset Filters
    const resetFiltersBtn = document.getElementById('resetFilters');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', resetFilters);
    }
    
    // Clear All Filters
    const clearAllFiltersBtn = document.getElementById('clearAllFilters');
    if (clearAllFiltersBtn) {
        clearAllFiltersBtn.addEventListener('click', resetFilters);
    }
    
    // Reset all filters function
    function resetFilters() {
        // Reset buttons
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-type="all"]').classList.add('active');
        
        // Reset inputs
        document.getElementById('minPrice').value = '';
        document.getElementById('maxPrice').value = '';
        document.getElementById('minAcres').value = '';
        document.getElementById('maxAcres').value = '';
        
        // Reset sort
        sortSelect.value = 'newest';
        
        // Reset state
        currentFilters = {
            type: 'all',
            minPrice: null,
            maxPrice: null,
            minAcres: null,
            maxAcres: null
        };
        currentSort = 'newest';
        
        displayListings();
    }
    
    // Main function to display listings
    function displayListings() {
        // Show loading
        listingsContainer.innerHTML = '';
        loadingIndicator.classList.remove('hidden');
        noResults.classList.add('hidden');
        
        // Simulate API delay
        setTimeout(() => {
            // Filter listings
            let filteredListings = filterListings(listings);
            
            // Sort listings
            filteredListings = sortListings(filteredListings, currentSort);
            
            // Update count
            listingCount.textContent = filteredListings.length;
            
            // Hide loading
            loadingIndicator.classList.add('hidden');
            
            // Show no results if empty
            if (filteredListings.length === 0) {
                noResults.classList.remove('hidden');
                return;
            }
            
            // Display listings
            if (currentView === 'grid') {
                displayGridView(filteredListings);
            } else {
                displayListView(filteredListings);
            }
        }, 500); // Simulated delay
    }
    
    // Filter function
    function filterListings(listings) {
        return listings.filter(listing => {
            // Type filter
            if (currentFilters.type !== 'all') {
                const listingType = listing.zoning.toLowerCase();
                const filterType = currentFilters.type.toLowerCase();
                if (!listingType.includes(filterType)) {
                    return false;
                }
            }
            
            // Price filter
            const price = parseFloat(listing.price.replace(/[^0-9.-]+/g, ""));
            if (currentFilters.minPrice && price < parseFloat(currentFilters.minPrice)) {
                return false;
            }
            if (currentFilters.maxPrice && price > parseFloat(currentFilters.maxPrice)) {
                return false;
            }
            
            // Acre filter
            if (currentFilters.minAcres && listing.acres < parseFloat(currentFilters.minAcres)) {
                return false;
            }
            if (currentFilters.maxAcres && listing.acres > parseFloat(currentFilters.maxAcres)) {
                return false;
            }
            
            return true;
        });
    }
    
    // Sort function
    function sortListings(listings, sortBy) {
        const sorted = [...listings];
        
        switch (sortBy) {
            case 'price-low':
                sorted.sort((a, b) => {
                    const priceA = parseFloat(a.price.replace(/[^0-9.-]+/g, ""));
                    const priceB = parseFloat(b.price.replace(/[^0-9.-]+/g, ""));
                    return priceA - priceB;
                });
                break;
                
            case 'price-high':
                sorted.sort((a, b) => {
                    const priceA = parseFloat(a.price.replace(/[^0-9.-]+/g, ""));
                    const priceB = parseFloat(b.price.replace(/[^0-9.-]+/g, ""));
                    return priceB - priceA;
                });
                break;
                
            case 'acres-low':
                sorted.sort((a, b) => a.acres - b.acres);
                break;
                
            case 'acres-high':
                sorted.sort((a, b) => b.acres - a.acres);
                break;
                
            case 'newest':
            default:
                // Keep original order (newest first based on ID)
                sorted.sort((a, b) => b.id - a.id);
                break;
        }
        
        return sorted;
    }
    
    // Grid View Display
    function displayGridView(listings) {
        listingsContainer.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8';
        
        listings.forEach(listing => {
            const card = `
                <div class="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition duration-300 h-full flex flex-col">
                    <!-- Badge -->
                    <div class="relative">
                        <div class="absolute top-4 left-4 z-10">
                            <span class="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                                ${listing.zoning}
                            </span>
                        </div>
                        <div class="h-56 overflow-hidden">
                            <img src="${listing.image}" alt="${listing.title}" class="w-full h-full object-cover hover:scale-105 transition duration-500">
                        </div>
                    </div>
                    
                    <!-- Content -->
                    <div class="p-6 flex-grow flex flex-col">
                        <h3 class="text-xl font-bold text-gray-800 mb-2 truncate">${listing.title}</h3>
                        <p class="text-gray-600 mb-4 flex items-center">
                            <i class="fas fa-map-marker-alt mr-2 text-green-600"></i>
                            ${listing.location}
                        </p>
                        
                        <!-- Features -->
                        <div class="mb-6 flex-grow">
                            <div class="flex flex-wrap gap-2 mb-4">
                                ${listing.features.slice(0, 3).map(feature => 
                                    `<span class="bg-gray-100 text-gray-800 text-xs px-3 py-1 rounded-full">${feature}</span>`
                                ).join('')}
                            </div>
                            <p class="text-gray-700 text-sm">${listing.description.substring(0, 120)}...</p>
                        </div>
                        
                        <!-- Price & Details -->
                        <div class="border-t pt-4 mt-auto">
                            <div class="flex justify-between items-center">
                                <div>
                                    <p class="text-2xl font-bold text-green-700">${listing.price}</p>
                                    <p class="text-gray-600 text-sm">${listing.acres} Acres</p>
                                </div>
                                <a href="listing-detail.html?id=${listing.id}" 
                                   class="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition">
                                    View
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            listingsContainer.innerHTML += card;
        });
    }
    
    // List View Display
    function displayListView(listings) {
        listingsContainer.className = 'space-y-6';
        
        listings.forEach(listing => {
            const card = `
                <div class="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition duration-300">
                    <div class="md:flex">
                        <!-- Image -->
                        <div class="md:w-1/3">
                            <div class="h-64 md:h-full relative">
                                <img src="${listing.image}" alt="${listing.title}" class="w-full h-full object-cover">
                                <div class="absolute top-4 left-4">
                                    <span class="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                                        ${listing.zoning}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Details -->
                        <div class="md:w-2/3 p-6">
                            <div class="flex flex-col h-full">
                                <div class="flex-grow">
                                    <h3 class="text-2xl font-bold text-gray-800 mb-2">${listing.title}</h3>
                                    <p class="text-gray-600 mb-4 flex items-center">
                                        <i class="fas fa-map-marker-alt mr-2 text-green-600"></i>
                                        ${listing.location}
                                    </p>
                                    
                                    <p class="text-gray-700 mb-6">${listing.description}</p>
                                    
                                    <div class="flex flex-wrap gap-2 mb-6">
                                        ${listing.features.map(feature => 
                                            `<span class="bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded-full">${feature}</span>`
                                        ).join('')}
                                    </div>
                                </div>
                                
                                <!-- Bottom Section -->
                                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-6 border-t">
                                    <div class="mb-4 sm:mb-0">
                                        <p class="text-3xl font-bold text-green-700 mb-1">${listing.price}</p>
                                        <div class="flex items-center text-gray-600">
                                            <i class="fas fa-ruler-combined mr-2"></i>
                                            <span class="mr-4">${listing.acres} Acres</span>
                                            <i class="fas fa-tag mr-2"></i>
                                            <span>${listing.zoning}</span>
                                        </div>
                                    </div>
                                    <div class="flex space-x-4">
                                        <button class="text-gray-600 hover:text-green-700 p-2" title="Save for later">
                                            <i class="far fa-heart"></i>
                                        </button>
                                        <a href="listing-detail.html?id=${listing.id}" 
                                           class="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition">
                                            View Details
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            listingsContainer.innerHTML += card;
        });
    }
    
    // Newsletter Form
    const newsletterForm = document.querySelector('form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = this.querySelector('input[type="email"]').value;
            if (email) {
                alert(`Thank you! You've been subscribed with: ${email}\nYou'll receive new listing alerts.`);
                this.reset();
            }
        });
    }
});