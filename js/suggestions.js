/* Ready-made wording for the "Invitation text" fields, by event type and language.
 * Hand-written (not machine translated). {occasion} is replaced with the category's
 * occasion word in that language. Exposed as window.IXSuggest */
(function () {
  'use strict';
  const GROUP = {
    wedding: 'fam', engagement: 'fam', anniversary: 'fam',
    birthday: 'party', farewell: 'party', school: 'party', custom: 'party',
    housewarming: 'sacred', religious: 'sacred', festival: 'sacred', community: 'sacred',
    corporate: 'corp', conference: 'corp', launch: 'corp',
  };

  const S = {
    en: {
      subtitle: {
        fam: ['Invite you to celebrate their {occasion}', 'Request the pleasure of your company at their {occasion}', 'Invite you to share in their joy'],
        party: ['You are invited to the {occasion}!', 'Join us for a day full of fun and laughter', 'Come celebrate with us'],
        sacred: ['Cordially invite you to the auspicious {occasion}', 'Seek your blessings on this sacred occasion', 'Invite you and your family to the {occasion}'],
        corp: ['You are cordially invited to the {occasion}', 'Join us for a day of ideas and networking', 'Be the first to see what is next'],
      },
      hostName: {
        fam: ['Both families', "The bride's & groom's families", 'With love, the whole family'],
        party: ['Family & friends', 'Mom & Dad', 'The whole gang'],
        sacred: ['The entire family', 'Family & well-wishers'],
        corp: ['The Organising Committee', 'The Leadership Team', 'The Events Team'],
      },
      familyName: {
        fam: ['Together with their families', 'With the blessings of our elders', 'With joy in our hearts'],
        party: ["Let's celebrate!", 'Save the date', 'Party time!'],
        sacred: ['With the blessings of the Almighty', '॥ Shree Ganeshaya Namah ॥', 'With the grace of our Kul Devta'],
        corp: ['Save the date', 'An exclusive invitation', 'You are invited'],
      },
      welcome: {
        fam: ['Two hearts, two families, one beautiful journey. We would be honoured to have you with us.', 'Your love and blessings are the greatest gift we could ask for. Welcome to our celebration!', 'We are so happy to share this special day with the people who mean the most to us.'],
        party: ["It wouldn't be a party without you. Come celebrate with us!", 'Get ready for good food, games and lots of laughter!', 'Bring your smiles and your dancing shoes – we cannot wait to see you!'],
        sacred: ['With folded hands, we welcome you and your family to share this blessed occasion with us.', 'Your presence will make this auspicious day complete.', 'Come, be a part of our prayers and celebrations.'],
        corp: ['We look forward to an engaging day of ideas, insights and conversations.', 'Join industry leaders and colleagues for a day of learning and networking.', 'Thank you for being part of our journey. We would be delighted to host you.'],
      },
      instructions: {
        all: ['Please arrive 15 minutes before the start time.', 'Parking is available at the venue.', 'Kindly confirm your attendance before the RSVP date.', 'Children are most welcome.'],
        fam: ['No boxed gifts please – your blessings are our gift.', 'Traditional attire is encouraged.'],
        party: ['Please let us know about any food allergies.', 'Dress up in the party theme if you like!'],
        sacred: ['Please remove footwear before entering the puja area.', 'Prasad will be served after the aarti.'],
        corp: ['Please carry a government photo ID for registration.', 'Wi-Fi details will be shared at the registration desk.', 'Business casual dress code.'],
      },
      extraInfo: {
        all: ['The venue is wheelchair accessible.', 'Photos from the event will be shared here after the celebration.', 'For any help, please call the contact person below.'],
        fam: ['Accommodation has been arranged for outstation guests – please contact us.', 'A live stream link will be shared for those who cannot attend.'],
        party: ['Snacks and dinner will be served.', 'Return gifts for all the little ones!'],
        sacred: ['Lunch (prasad) will be served after the ceremony.', 'Accommodation is available for guests travelling from far.'],
        corp: ['Presentation slides will be shared with all attendees after the event.', 'Lunch and refreshments will be provided.', 'Airport transfers are available on request.'],
      },
      thankyou: {
        fam: ['Thank you for being part of our story.', 'Your presence and blessings mean the world to us.', 'We cannot wait to celebrate with you!'],
        party: ['Thank you for making the day so special!', 'See you there – it is going to be fun!'],
        sacred: ['May the divine blessings be with you and your family.', 'Your presence and blessings mean the world to us.'],
        corp: ['Thank you. We look forward to seeing you there.', 'We look forward to building the future together.'],
      },
    },
    hi: {
      subtitle: {
        fam: ['आपको अपने {occasion} समारोह में सादर आमंत्रित करते हैं', 'अपने {occasion} में आपकी उपस्थिति की कामना करते हैं', 'अपनी खुशियों में शामिल होने का निमंत्रण देते हैं'],
        party: ['आप {occasion} में सादर आमंत्रित हैं!', 'मस्ती और हँसी से भरे दिन में हमारे साथ शामिल हों', 'आइए, साथ मिलकर जश्न मनाएं'],
        sacred: ['आपको शुभ {occasion} में सादर आमंत्रित करते हैं', 'इस पावन अवसर पर आपका आशीर्वाद चाहते हैं', 'आपको सपरिवार {occasion} में आमंत्रित करते हैं'],
        corp: ['आप {occasion} में सादर आमंत्रित हैं', 'विचारों और नेटवर्किंग के दिन में हमारे साथ जुड़ें'],
      },
      hostName: {
        fam: ['दोनों परिवार', 'वर एवं वधू पक्ष', 'समस्त परिवार'],
        party: ['परिवार एवं मित्रगण', 'मम्मी-पापा'],
        sacred: ['समस्त परिवार', 'परिवार एवं शुभचिंतक'],
        corp: ['आयोजन समिति', 'प्रबंधन टीम'],
      },
      familyName: {
        fam: ['परिवार सहित', 'बड़ों के आशीर्वाद से', 'हर्षित मन से'],
        party: ['आइए जश्न मनाएं!', 'तारीख़ याद रखें'],
        sacred: ['ईश्वर की असीम कृपा से', '॥ श्री गणेशाय नमः ॥', 'कुल देवता के आशीर्वाद से'],
        corp: ['तारीख़ याद रखें', 'विशेष निमंत्रण'],
      },
      welcome: {
        fam: ['दो दिल, दो परिवार, एक सुंदर सफ़र। आपकी उपस्थिति हमारे लिए सम्मान होगी।', 'आपका प्रेम और आशीर्वाद ही हमारे लिए सबसे बड़ा उपहार है। हमारे समारोह में आपका स्वागत है!'],
        party: ['आपके बिना पार्टी अधूरी है। आइए, साथ मिलकर जश्न मनाएं!', 'स्वादिष्ट भोजन, खेल और ढेर सारी मस्ती के लिए तैयार रहिए!'],
        sacred: ['हम करबद्ध होकर आपका और आपके परिवार का इस पावन अवसर पर स्वागत करते हैं।', 'आपकी उपस्थिति से यह शुभ दिन पूर्ण होगा।'],
        corp: ['विचारों, अनुभवों और सार्थक चर्चाओं से भरे दिन में आपका स्वागत है।'],
      },
      instructions: {
        all: ['कृपया कार्यक्रम से 15 मिनट पहले पधारें।', 'स्थल पर पार्किंग उपलब्ध है।', 'कृपया RSVP तिथि से पहले अपनी उपस्थिति की पुष्टि करें।', 'बच्चों का स्वागत है।'],
        fam: ['कृपया डिब्बाबंद उपहार न लाएं – आपका आशीर्वाद ही हमारा उपहार है।', 'पारंपरिक परिधान में पधारें।'],
        sacred: ['पूजा स्थल में प्रवेश से पहले कृपया जूते उतारें।', 'आरती के बाद प्रसाद वितरित किया जाएगा।'],
        corp: ['पंजीकरण के लिए कृपया सरकारी फ़ोटो पहचान पत्र साथ लाएं।'],
      },
      extraInfo: {
        all: ['स्थल व्हीलचेयर के अनुकूल है।', 'कार्यक्रम की तस्वीरें बाद में यहाँ साझा की जाएंगी।', 'किसी भी सहायता के लिए नीचे दिए संपर्क व्यक्ति को कॉल करें।'],
        fam: ['बाहर से आने वाले अतिथियों के ठहरने की व्यवस्था की गई है – कृपया संपर्क करें।'],
        sacred: ['पूजा के बाद भोजन (प्रसाद) की व्यवस्था है।'],
      },
      thankyou: {
        fam: ['हमारी कहानी का हिस्सा बनने के लिए धन्यवाद।', 'आपकी उपस्थिति और आशीर्वाद हमारे लिए अनमोल हैं।'],
        party: ['इस दिन को ख़ास बनाने के लिए धन्यवाद!'],
        sacred: ['ईश्वर की कृपा आप और आपके परिवार पर सदा बनी रहे।', 'आपकी उपस्थिति और आशीर्वाद हमारे लिए अनमोल हैं।'],
        corp: ['धन्यवाद। हम आपसे मिलने की प्रतीक्षा में हैं।'],
      },
    },
    pa: {
      subtitle: {
        fam: ['ਤੁਹਾਨੂੰ ਆਪਣੇ {occasion} ਦੇ ਜਸ਼ਨ ਵਿੱਚ ਸੱਦਾ ਦਿੰਦੇ ਹਨ', 'ਆਪਣੀਆਂ ਖ਼ੁਸ਼ੀਆਂ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਣ ਦਾ ਸੱਦਾ ਦਿੰਦੇ ਹਨ'],
        party: ['ਤੁਸੀਂ {occasion} ਵਿੱਚ ਸੱਦੇ ਗਏ ਹੋ!', 'ਆਓ, ਰਲ ਕੇ ਜਸ਼ਨ ਮਨਾਈਏ'],
        sacred: ['ਤੁਹਾਨੂੰ ਸ਼ੁਭ {occasion} ਵਿੱਚ ਸੱਦਾ ਦਿੰਦੇ ਹਨ', 'ਇਸ ਪਵਿੱਤਰ ਮੌਕੇ \'ਤੇ ਤੁਹਾਡਾ ਅਸ਼ੀਰਵਾਦ ਚਾਹੁੰਦੇ ਹਨ'],
        corp: ['ਤੁਸੀਂ {occasion} ਵਿੱਚ ਸਤਿਕਾਰ ਸਹਿਤ ਸੱਦੇ ਗਏ ਹੋ'],
      },
      hostName: {
        fam: ['ਦੋਵੇਂ ਪਰਿਵਾਰ', 'ਸਾਰਾ ਪਰਿਵਾਰ'],
        party: ['ਪਰਿਵਾਰ ਅਤੇ ਦੋਸਤ', 'ਮੰਮੀ-ਪਾਪਾ'],
        sacred: ['ਸਾਰਾ ਪਰਿਵਾਰ'],
        corp: ['ਪ੍ਰਬੰਧਕ ਕਮੇਟੀ'],
      },
      familyName: {
        fam: ['ਪਰਿਵਾਰਾਂ ਸਮੇਤ', 'ਵੱਡਿਆਂ ਦੇ ਅਸ਼ੀਰਵਾਦ ਨਾਲ'],
        party: ['ਆਓ ਜਸ਼ਨ ਮਨਾਈਏ!', 'ਤਾਰੀਖ਼ ਯਾਦ ਰੱਖੋ'],
        sacred: ['ਵਾਹਿਗੁਰੂ ਦੀ ਕਿਰਪਾ ਨਾਲ', 'ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ'],
        corp: ['ਤਾਰੀਖ਼ ਯਾਦ ਰੱਖੋ', 'ਖ਼ਾਸ ਸੱਦਾ'],
      },
      welcome: {
        fam: ['ਦੋ ਦਿਲ, ਦੋ ਪਰਿਵਾਰ, ਇੱਕ ਸੋਹਣਾ ਸਫ਼ਰ। ਤੁਹਾਡੀ ਹਾਜ਼ਰੀ ਸਾਡੇ ਲਈ ਮਾਣ ਵਾਲੀ ਗੱਲ ਹੋਵੇਗੀ।', 'ਤੁਹਾਡਾ ਪਿਆਰ ਅਤੇ ਅਸ਼ੀਰਵਾਦ ਹੀ ਸਾਡਾ ਸਭ ਤੋਂ ਵੱਡਾ ਤੋਹਫ਼ਾ ਹੈ। ਜੀ ਆਇਆਂ ਨੂੰ!'],
        party: ['ਤੁਹਾਡੇ ਬਿਨਾਂ ਪਾਰਟੀ ਅਧੂਰੀ ਹੈ। ਆਓ, ਰਲ ਕੇ ਜਸ਼ਨ ਮਨਾਈਏ!'],
        sacred: ['ਅਸੀਂ ਹੱਥ ਜੋੜ ਕੇ ਤੁਹਾਡਾ ਅਤੇ ਤੁਹਾਡੇ ਪਰਿਵਾਰ ਦਾ ਇਸ ਪਵਿੱਤਰ ਮੌਕੇ \'ਤੇ ਸਵਾਗਤ ਕਰਦੇ ਹਾਂ।'],
        corp: ['ਵਿਚਾਰਾਂ ਅਤੇ ਗੱਲਬਾਤ ਨਾਲ ਭਰੇ ਦਿਨ ਵਿੱਚ ਤੁਹਾਡਾ ਸਵਾਗਤ ਹੈ।'],
      },
      instructions: {
        all: ['ਕਿਰਪਾ ਕਰਕੇ ਪ੍ਰੋਗਰਾਮ ਤੋਂ 15 ਮਿੰਟ ਪਹਿਲਾਂ ਪਹੁੰਚੋ।', 'ਸਥਾਨ \'ਤੇ ਪਾਰਕਿੰਗ ਉਪਲਬਧ ਹੈ।', 'ਬੱਚਿਆਂ ਦਾ ਸਵਾਗਤ ਹੈ।'],
        fam: ['ਕਿਰਪਾ ਕਰਕੇ ਡੱਬਾਬੰਦ ਤੋਹਫ਼ੇ ਨਾ ਲਿਆਓ – ਤੁਹਾਡਾ ਅਸ਼ੀਰਵਾਦ ਹੀ ਸਾਡਾ ਤੋਹਫ਼ਾ ਹੈ।'],
        sacred: ['ਕਿਰਪਾ ਕਰਕੇ ਸਿਰ ਢੱਕ ਕੇ ਆਓ।'],
      },
      extraInfo: {
        all: ['ਪ੍ਰੋਗਰਾਮ ਦੀਆਂ ਤਸਵੀਰਾਂ ਬਾਅਦ ਵਿੱਚ ਇੱਥੇ ਸਾਂਝੀਆਂ ਕੀਤੀਆਂ ਜਾਣਗੀਆਂ।', 'ਕਿਸੇ ਵੀ ਮਦਦ ਲਈ ਹੇਠਾਂ ਦਿੱਤੇ ਸੰਪਰਕ ਨੂੰ ਕਾਲ ਕਰੋ।'],
        sacred: ['ਸਮਾਗਮ ਤੋਂ ਬਾਅਦ ਗੁਰੂ ਕਾ ਲੰਗਰ ਅਟੁੱਟ ਵਰਤੇਗਾ।'],
      },
      thankyou: {
        fam: ['ਸਾਡੀ ਕਹਾਣੀ ਦਾ ਹਿੱਸਾ ਬਣਨ ਲਈ ਧੰਨਵਾਦ।', 'ਤੁਹਾਡੀ ਹਾਜ਼ਰੀ ਅਤੇ ਅਸ਼ੀਰਵਾਦ ਸਾਡੇ ਲਈ ਅਨਮੋਲ ਹਨ।'],
        party: ['ਇਸ ਦਿਨ ਨੂੰ ਖ਼ਾਸ ਬਣਾਉਣ ਲਈ ਧੰਨਵਾਦ!'],
        sacred: ['ਵਾਹਿਗੁਰੂ ਤੁਹਾਡੇ ਪਰਿਵਾਰ \'ਤੇ ਸਦਾ ਮਿਹਰ ਕਰੇ।'],
        corp: ['ਧੰਨਵਾਦ। ਅਸੀਂ ਤੁਹਾਨੂੰ ਮਿਲਣ ਦੀ ਉਡੀਕ ਵਿੱਚ ਹਾਂ।'],
      },
    },
  };
  // Fields where a tap ADDS a line (lists) instead of replacing the text
  const APPEND = ['instructions', 'extraInfo'];

  function list(category, lang, field) {
    const g = GROUP[category] || 'party';
    const L = S[lang] || S.en;
    const f = L[field] || {}; // no English fallback inside a Hindi/Punjabi tab
    const cat = (window.IXT && IXT.CATEGORIES.find((c) => c.id === category)) || { occasion: {} };
    const occ = cat.occasion[lang] || cat.occasion.en || '';
    return [...(f[g] || []), ...(f.all || [])].map((s) => s.replace('{occasion}', occ));
  }
  window.IXSuggest = { list, APPEND, FIELDS: Object.keys(S.en) };
})();
