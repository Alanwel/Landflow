// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
  // Function to display featured listings on homepage
  if (document.getElementById('featuredListings')) {
    displayFeaturedListings();
  }
  
  // Function to display all listings on listings page
  if (document.getElementById('allListings')) {
    displayAllListings();
  }
  
  // Function to display single listing on detail page
  if (document.getElementById('listingDetail')) {
    displayListingDetail();
  }
});

// Display 3 featured listings on homepage
function displayFeaturedListings() {
  const container = document.getElementById('featuredListings');
  const featured = listings.filter(listing => listing.featured).slice(0, 3);
  
  featured.forEach(listing => {
    const card = `
            <div class="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition duration-300">
                <div class="h-48 overflow-hidden">
                    <img src="${listing.image}" alt="${listing.title}" class="w-full h-full object-cover hover:scale-105 transition duration-500">
                </div>
                <div class="p-6">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="text-xl font-bold text-gray-800">${listing.title}</h3>
                        <span class="bg-green-100 text-green-800 text-sm font-semibold px-3 py-1 rounded-full">${listing.status}</span>
                    </div>
                    <p class="text-gray-600 mb-4">${listing.location}</p>
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-2xl font-bold text-green-700">${listing.price}</span>
                        <span class="text-gray-700"><i class="fas fa-ruler-combined mr-1"></i>${listing.acres} Acres</span>
                    </div>
                    <p class="text-gray-700 mb-4">${listing.description.substring(0, 100)}...</p>
                    <div class="flex flex-wrap gap-2 mb-6">
                        ${listing.features.slice(0, 3).map(feature => 
                            `<span class="bg-gray-100 text-gray-800 text-xs px-3 py-1 rounded-full">${feature}</span>`
                        ).join('')}
                    </div>
                    <a href="listing-detail.html?id=${listing.id}" 
                       class="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition">
                        View Details <i class="fas fa-arrow-right ml-2"></i>
                    </a>
                </div>
            </div>
        `;
    container.innerHTML += card;
  });
}

// Display all listings on listings.html
function displayAllListings() {
  const container = document.getElementById('allListings');
  
  listings.forEach(listing => {
    const card = `
            <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition duration-300">
                <div class="md:flex">
                    <div class="md:w-1/3 h-64 md:h-auto">
                        <img src="${listing.image}" alt="${listing.title}" class="w-full h-full object-cover">
                    </div>
                    <div class="md:w-2/3 p-6">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="text-2xl font-bold text-gray-800 mb-2">${listing.title}</h3>
                                <p class="text-gray-600 mb-4"><i class="fas fa-map-marker-alt mr-2"></i>${listing.location}</p>
                            </div>
                            <span class="bg-green-100 text-green-800 font-bold px-4 py-1 rounded-full">${listing.status}</span>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <p class="text-sm text-gray-500">Price</p>
                                <p class="text-2xl font-bold text-green-700">${listing.price}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Size</p>
                                <p class="text-xl font-bold text-gray-800">${listing.acres} Acres</p>
                            </div>
                        </div>
                        
                        <p class="text-gray-700 mb-4">${listing.description}</p>
                        
                        <div class="flex flex-wrap gap-2 mb-6">
                            ${listing.features.map(feature => 
                                `<span class="bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded-full">${feature}</span>`
                            ).join('')}
                        </div>
                        
                        <div class="flex justify-between items-center">
                            <span class="text-gray-700"><i class="fas fa-draw-polygon mr-1"></i> Zoning: ${listing.zoning}</span>
                            <a href="listing-detail.html?id=${listing.id}" 
                               class="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition">
                                View Details
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    container.innerHTML += card;
  });
}

// Display single listing on detail page
function displayListingDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = parseInt(urlParams.get('id'));
  const listing = listings.find(l => l.id === id);
  
  if (!listing) {
    document.getElementById('listingDetail').innerHTML = `
            <div class="text-center py-20">
                <h2 class="text-3xl font-bold text-gray-800 mb-4">Listing Not Found</h2>
                <a href="listings.html" class="text-green-600 hover:text-green-800 font-semibold">← Back to Listings</a>
            </div>
        `;
    return;
  }
  
  document.getElementById('listingDetail').innerHTML = `
        <div class="mb-6">
            <a href="listings.html" class="text-green-600 hover:text-green-800 font-semibold">
                <i class="fas fa-arrow-left mr-2"></i>Back to Listings
            </a>
        </div>
        
        <div class="bg-white rounded-xl shadow-lg overflow-hidden">
            <div class="md:flex">
                <div class="md:w-1/2">
                    <img src="${listing.image}" alt="${listing.title}" class="w-full h-full object-cover">
                </div>
                <div class="md:w-1/2 p-8">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h1 class="text-3xl font-bold text-gray-800 mb-2">${listing.title}</h1>
                            <p class="text-gray-600 text-xl"><i class="fas fa-map-marker-alt mr-2"></i>${listing.location}</p>
                        </div>
                        <span class="bg-green-100 text-green-800 text-lg font-bold px-4 py-2 rounded-full">${listing.status}</span>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-6 mb-8">
                        <div class="text-center p-4 bg-gray-50 rounded-lg">
                            <p class="text-sm text-gray-500">Price</p>
                            <p class="text-3xl font-bold text-green-700">${listing.price}</p>
                        </div>
                        <div class="text-center p-4 bg-gray-50 rounded-lg">
                            <p class="text-sm text-gray-500">Size</p>
                            <p class="text-3xl font-bold text-gray-800">${listing.acres} Acres</p>
                        </div>
                    </div>
                    
                    <div class="mb-8">
                        <h3 class="text-xl font-bold text-gray-800 mb-4">Property Description</h3>
                        <p class="text-gray-700 text-lg">${listing.description}</p>
                    </div>
                    
                    <div class="mb-8">
                        <h3 class="text-xl font-bold text-gray-800 mb-4">Key Features</h3>
                        <div class="flex flex-wrap gap-3">
                            ${listing.features.map(feature => 
                                `<span class="bg-green-50 text-green-800 border border-green-200 text-lg px-4 py-2 rounded-full">${feature}</span>`
                            ).join('')}
                        </div>
                    </div>
                    
                    <div class="mb-8">
                        <h3 class="text-xl font-bold text-gray-800 mb-4">Property Details</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="flex items-center">
                                <i class="fas fa-draw-polygon text-green-600 mr-3 text-xl"></i>
                                <div>
                                    <p class="text-sm text-gray-500">Zoning</p>
                                    <p class="font-semibold">${listing.zoning}</p>
                                </div>
                            </div>
                            <div class="flex items-center">
                                <i class="fas fa-ruler-combined text-green-600 mr-3 text-xl"></i>
                                <div>
                                    <p class="text-sm text-gray-500">Land Size</p>
                                    <p class="font-semibold">${listing.acres} Acres</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <button id="inquireBtn" class="w-full bg-green-600 hover:bg-green-700 text-white text-xl font-bold py-4 px-6 rounded-lg transition duration-300">
                        <i class="fas fa-envelope mr-3"></i>Inquire About This Property
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Inquiry Modal (hidden by default) -->
        <div id="inquiryModal" class="hidden fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-8">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-bold text-gray-800">Inquire About: ${listing.title}</h3>
                    <button id="closeModal" class="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                </div>
                <form id="inquiryForm" class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block text-gray-700 mb-2">Full Name</label>
                            <input type="text" required class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
                        </div>
                        <div>
                            <label class="block text-gray-700 mb-2">Email Address</label>
                            <input type="email" required class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
                        </div>
                    </div>
                    <div>
                        <label class="block text-gray-700 mb-2">Phone Number</label>
                        <input type="tel" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
                    </div>
                    <div>
                        <label class="block text-gray-700 mb-2">Message</label>
                        <textarea rows="4" required class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">Hi, I'm interested in ${listing.title} (${listing.acres} acres for ${listing.price}). Please send me more information.</textarea>
                    </div>
                    <button type="submit" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition">
                        Send Inquiry <i class="fas fa-paper-plane ml-2"></i>
                    </button>
                </form>
            </div>
        </div>
    `;
  
  // Add modal functionality
  const inquireBtn = document.getElementById('inquireBtn');
  const closeModal = document.getElementById('closeModal');
  const modal = document.getElementById('inquiryModal');
  const form = document.getElementById('inquiryForm');
  
  if (inquireBtn && modal && closeModal && form) {
    inquireBtn.addEventListener('click', () => {
      modal.classList.remove('hidden');
    });
    
    closeModal.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
    
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      alert('Thank you! Your inquiry has been sent. We will contact you within 24 hours.');
      modal.classList.add('hidden');
      form.reset();
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  }
}
