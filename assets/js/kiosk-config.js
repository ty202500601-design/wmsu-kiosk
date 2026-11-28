/* Centralized editable content for WMSU Canteen Kiosk (Zero external stock URLs — all dish media comes from DB image_path) */
window.KIOSK_CONFIG = {
  campus: {
    name: 'WMSU Campus Canteen',
    location: 'Main Campus Food Court, Normal Road, Baliwasan, Zamboanga City',
    defaultOpen: '07:00',
    defaultClose: '18:00',
    closedReopenLabel: 'Opens at 8:00 AM',
    idleTimeoutMs: 180000, // 3 minutes before 15s cart reset prompt
    idleWarnSec: 15
  },

  /* Curated Student Combo Bundles
     Leave photo: '' so combos automatically render a side-by-side collage of their matched items' real photos */
  combos: [
    {
      id: 'combo-silog',
      title: 'Crimson Silog Saver',
      subtitle: 'All-day garlic rice meal + chilled house drink',
      badge: 'Student Favorite',
      matchNames: ['tapsilog', 'iced tea'],
      photo: ''
    },
    {
      id: 'combo-burger',
      title: 'Barkada Burger Meal',
      subtitle: 'Grilled cheeseburger, crispy fries & cold soda',
      badge: 'Best Value',
      matchNames: ['cheeseburger', 'french fries', 'soda'],
      photo: ''
    },
    {
      id: 'combo-adobo',
      title: 'Lutong-Bahay Lunch Pair',
      subtitle: 'Classic Chicken Adobo + refreshing Iced Tea',
      badge: 'Hot Lunch',
      matchNames: ['chicken adobo', 'iced tea'],
      photo: ''
    }
  ],

  /* Editable Slim Promo Banners */
  promos: [
    {
      eyebrow: 'Multi-Stall Cart',
      title: 'Mix & Match Across Stalls',
      body: 'Add ulam from one stall and drinks or burgers from another in a single checkout.',
      tone: 'maroon',
      icon: 'basket2-fill',
      cta: 'Browse Stalls',
      href: '#stalls-section'
    },
    {
      eyebrow: 'GCash QR & Cash',
      title: 'Pay Per Stall Your Way',
      body: 'Scan GCash QR on participating stalls or pay Cash at Counter when your order is called.',
      tone: 'warm',
      icon: 'qr-code-scan',
      cta: 'How It Works',
      href: '#how-it-works'
    },
    {
      eyebrow: 'Morning & Break Rush',
      title: 'Fresh Silog & Merienda Daily',
      body: 'Dine-in trays or packed take-out bags ready at the counter from 7:00 AM to 6:00 PM.',
      tone: 'dark',
      icon: 'cup-hot-fill',
      cta: 'Track Order',
      href: 'tracking.html'
    }
  ]
};
