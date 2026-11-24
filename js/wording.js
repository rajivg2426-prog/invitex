/* Matching wording sets ("type of message").
 * Each set fills every wording field of the invitation at once (top line, line
 * under the title, welcome, main message and thank-you) in ONE consistent tone,
 * so the card reads as a single piece instead of a mix of unrelated lines.
 * Hand-written in each language (not machine translated). {occasion} is replaced
 * with the occasion word for the chosen event type. Exposed as window.IXWording */
(function () {
  'use strict';
  const GROUP = {
    wedding: 'fam', engagement: 'fam', anniversary: 'fam',
    birthday: 'party', farewell: 'party', school: 'party', custom: 'party',
    housewarming: 'sacred', religious: 'sacred', festival: 'sacred', community: 'sacred',
    corporate: 'corp', conference: 'corp', launch: 'corp',
  };

  // Which tones each kind of event offers, in display order.
  const TONES = {
    fam: ['traditional', 'warm', 'formal', 'royal'],
    party: ['fun', 'warm', 'simple'],
    sacred: ['devotional', 'traditional', 'warm'],
    corp: ['formal', 'friendly'],
  };
  // The main-message template (themes.js) used for each tone.
  const MSG_STYLE = { traditional: 'traditional', warm: 'friendly', formal: 'formal', royal: 'royal', fun: 'modern', simple: 'formal', devotional: 'religious', friendly: 'formal' };
  const MSG_STYLE_CORP = { formal: 'corporate', friendly: 'formal' };

  const LABEL = {
    en: { traditional: 'Traditional', warm: 'Warm & personal', formal: 'Formal', royal: 'Royal & grand', fun: 'Fun & lively', simple: 'Short & simple', devotional: 'Devotional', friendly: 'Friendly' },
    hi: { traditional: 'पारंपरिक', warm: 'आत्मीय', formal: 'औपचारिक', royal: 'शाही', fun: 'मज़ेदार', simple: 'सरल', devotional: 'भक्तिमय', friendly: 'मैत्रीपूर्ण' },
    pa: { traditional: 'ਰਵਾਇਤੀ', warm: 'ਨਿੱਘਾ', formal: 'ਰਸਮੀ', royal: 'ਸ਼ਾਹੀ', fun: 'ਮਜ਼ੇਦਾਰ', simple: 'ਸਾਦਾ', devotional: 'ਧਾਰਮਿਕ', friendly: 'ਦੋਸਤਾਨਾ' },
  };

  // fields: familyName (small line above the title), subtitle (line under the title), welcome, thankyou
  const SETS = {
    en: {
      fam: {
        traditional: { familyName: 'With the blessings of our elders', subtitle: 'Cordially invite you and your family to the {occasion}', welcome: 'With joy in our hearts and the blessings of our families, we welcome you to this auspicious celebration.', thankyou: 'Your presence and blessings will make this day complete.' },
        warm: { familyName: 'Together with their families', subtitle: 'Would love you to celebrate their {occasion} with them', welcome: 'Two hearts, two families, one beautiful journey. It would mean the world to us to have you there.', thankyou: 'Thank you for being part of our story. See you soon!' },
        formal: { familyName: 'Together with their families', subtitle: 'Request the pleasure of your company at their {occasion}', welcome: 'We would be honoured by your presence as we begin this new chapter.', thankyou: 'Kindly confirm your attendance. We look forward to welcoming you.' },
        royal: { familyName: 'Under the gracious blessings of our ancestors', subtitle: 'Request the honour of your presence at the grand {occasion}', welcome: 'With great joy, the families invite you to an evening of tradition, music and splendour.', thankyou: 'Your gracious presence will add to the grandeur of the occasion.' },
      },
      party: {
        fun: { familyName: "Let's celebrate!", subtitle: 'You are invited to the {occasion}!', welcome: 'Get ready for good food, games and lots of laughter. It would not be a party without you!', thankyou: 'Thank you for making the day extra special!' },
        warm: { familyName: 'With love', subtitle: 'Please join us for the {occasion}', welcome: 'We are so happy to share this special day with the people who mean the most to us.', thankyou: 'Your presence is the best gift of all.' },
        simple: { familyName: 'Save the date', subtitle: 'You are invited to the {occasion}', welcome: 'We would be glad to have you with us.', thankyou: 'Hope to see you there.' },
      },
      sacred: {
        devotional: { familyName: '॥ Shree Ganeshaya Namah ॥', subtitle: 'Humbly invite you to the sacred {occasion}', welcome: 'With folded hands, we welcome you and your family to join our prayers on this blessed occasion.', thankyou: 'May the divine bless you and your family always.' },
        traditional: { familyName: 'With the grace of the Almighty', subtitle: 'Cordially invite you and your family to the {occasion}', welcome: 'Your presence will make this auspicious day complete.', thankyou: 'With gratitude for your blessings and good wishes.' },
        warm: { familyName: 'With joy in our hearts', subtitle: 'Would love you to join our {occasion}', welcome: 'Come, be a part of our celebrations and share a meal with us.', thankyou: 'Thank you for celebrating with us.' },
      },
      corp: {
        formal: { familyName: 'An exclusive invitation', subtitle: 'You are cordially invited to the {occasion}', welcome: 'We look forward to an engaging day of ideas, insights and conversations.', thankyou: 'Thank you. We look forward to welcoming you.' },
        friendly: { familyName: 'Save the date', subtitle: 'Join us for the {occasion}', welcome: 'Meet colleagues, share ideas and enjoy a great day together.', thankyou: 'See you there!' },
      },
    },
    hi: {
      fam: {
        traditional: { familyName: 'बड़ों के आशीर्वाद से', subtitle: 'आपको सपरिवार {occasion} में सादर आमंत्रित करते हैं', welcome: 'परिवारों के आशीर्वाद और हृदय में अपार हर्ष के साथ, हम इस शुभ अवसर पर आपका स्वागत करते हैं।', thankyou: 'आपकी उपस्थिति एवं आशीर्वाद से यह दिन पूर्ण होगा।' },
        warm: { familyName: 'परिवारों के साथ', subtitle: 'अपने {occasion} में आपको अपने बीच देखना चाहते हैं', welcome: 'दो दिल, दो परिवार, एक सुंदर सफ़र। आपका साथ हमारे लिए बहुत मायने रखता है।', thankyou: 'हमारी कहानी का हिस्सा बनने के लिए धन्यवाद। जल्द मिलते हैं!' },
        formal: { familyName: 'परिवारों सहित', subtitle: 'अपने {occasion} में आपकी गरिमामयी उपस्थिति का अनुरोध करते हैं', welcome: 'इस नए अध्याय के आरंभ पर आपकी उपस्थिति हमारे लिए सम्मान की बात होगी।', thankyou: 'कृपया अपनी उपस्थिति की पुष्टि करें। हम आपके स्वागत की प्रतीक्षा में हैं।' },
        royal: { familyName: 'पूर्वजों के मंगल आशीर्वाद से', subtitle: 'भव्य {occasion} में आपकी गरिमामयी उपस्थिति का अनुरोध करते हैं', welcome: 'परंपरा, संगीत और वैभव से भरी इस संध्या में परिवार आपको हर्षपूर्वक आमंत्रित करते हैं।', thankyou: 'आपकी उपस्थिति इस अवसर की शोभा बढ़ाएगी।' },
      },
      party: {
        fun: { familyName: 'चलो जश्न मनाएँ!', subtitle: 'आप {occasion} में आमंत्रित हैं!', welcome: 'स्वादिष्ट खाना, खेल और ढेर सारी मस्ती आपका इंतज़ार कर रही है। आपके बिना पार्टी अधूरी है!', thankyou: 'इस दिन को ख़ास बनाने के लिए धन्यवाद!' },
        warm: { familyName: 'प्यार सहित', subtitle: 'कृपया हमारे {occasion} में शामिल हों', welcome: 'यह ख़ास दिन हम उन लोगों के साथ मनाना चाहते हैं जो हमारे सबसे क़रीब हैं।', thankyou: 'आपकी उपस्थिति ही सबसे अच्छा उपहार है।' },
        simple: { familyName: 'तारीख़ याद रखें', subtitle: 'आप {occasion} में आमंत्रित हैं', welcome: 'आपके आने से हमें ख़ुशी होगी।', thankyou: 'आपसे मिलने की आशा है।' },
      },
      sacred: {
        devotional: { familyName: '॥ श्री गणेशाय नमः ॥', subtitle: 'पावन {occasion} में आपको विनम्रतापूर्वक आमंत्रित करते हैं', welcome: 'हाथ जोड़कर हम आपका और आपके परिवार का इस पावन अवसर पर प्रार्थना में सम्मिलित होने हेतु स्वागत करते हैं।', thankyou: 'ईश्वर आप और आपके परिवार पर सदा कृपा बनाए रखें।' },
        traditional: { familyName: 'प्रभु की असीम कृपा से', subtitle: 'आपको सपरिवार {occasion} में सादर आमंत्रित करते हैं', welcome: 'आपकी उपस्थिति से यह शुभ दिन पूर्ण होगा।', thankyou: 'आपके आशीर्वाद और शुभकामनाओं के लिए हृदय से आभार।' },
        warm: { familyName: 'हर्ष के साथ', subtitle: 'हमारे {occasion} में आपको अपने बीच देखना चाहते हैं', welcome: 'आइए, हमारे उत्सव का हिस्सा बनिए और हमारे साथ भोजन कीजिए।', thankyou: 'हमारे साथ उत्सव मनाने के लिए धन्यवाद।' },
      },
      corp: {
        formal: { familyName: 'विशेष आमंत्रण', subtitle: 'आप {occasion} में सादर आमंत्रित हैं', welcome: 'विचारों, अंतर्दृष्टि और संवाद से भरे दिन में आपका स्वागत है।', thankyou: 'धन्यवाद। हम आपके स्वागत की प्रतीक्षा में हैं।' },
        friendly: { familyName: 'तारीख़ याद रखें', subtitle: 'हमारे {occasion} में शामिल हों', welcome: 'सहकर्मियों से मिलें, विचार साझा करें और एक अच्छा दिन साथ बिताएँ।', thankyou: 'वहाँ मिलते हैं!' },
      },
    },
    pa: {
      fam: {
        traditional: { familyName: 'ਵੱਡਿਆਂ ਦੇ ਅਸ਼ੀਰਵਾਦ ਨਾਲ', subtitle: 'ਤੁਹਾਨੂੰ ਪਰਿਵਾਰ ਸਮੇਤ {occasion} ਵਿੱਚ ਨਿੱਘਾ ਸੱਦਾ ਦਿੰਦੇ ਹਨ', welcome: 'ਪਰਿਵਾਰਾਂ ਦੇ ਅਸ਼ੀਰਵਾਦ ਅਤੇ ਦਿਲੋਂ ਖ਼ੁਸ਼ੀ ਨਾਲ, ਅਸੀਂ ਇਸ ਸ਼ੁਭ ਮੌਕੇ \'ਤੇ ਤੁਹਾਡਾ ਸਵਾਗਤ ਕਰਦੇ ਹਾਂ।', thankyou: 'ਤੁਹਾਡੀ ਹਾਜ਼ਰੀ ਅਤੇ ਅਸ਼ੀਰਵਾਦ ਨਾਲ ਇਹ ਦਿਨ ਪੂਰਾ ਹੋਵੇਗਾ।' },
        warm: { familyName: 'ਪਰਿਵਾਰਾਂ ਦੇ ਨਾਲ', subtitle: 'ਆਪਣੇ {occasion} ਵਿੱਚ ਤੁਹਾਨੂੰ ਆਪਣੇ ਵਿਚਕਾਰ ਦੇਖਣਾ ਚਾਹੁੰਦੇ ਹਨ', welcome: 'ਦੋ ਦਿਲ, ਦੋ ਪਰਿਵਾਰ, ਇੱਕ ਸੋਹਣਾ ਸਫ਼ਰ। ਤੁਹਾਡਾ ਸਾਥ ਸਾਡੇ ਲਈ ਬਹੁਤ ਮਾਇਨੇ ਰੱਖਦਾ ਹੈ।', thankyou: 'ਸਾਡੀ ਕਹਾਣੀ ਦਾ ਹਿੱਸਾ ਬਣਨ ਲਈ ਧੰਨਵਾਦ। ਜਲਦੀ ਮਿਲਦੇ ਹਾਂ!' },
        formal: { familyName: 'ਪਰਿਵਾਰਾਂ ਸਮੇਤ', subtitle: 'ਆਪਣੇ {occasion} ਵਿੱਚ ਤੁਹਾਡੀ ਹਾਜ਼ਰੀ ਦੀ ਬੇਨਤੀ ਕਰਦੇ ਹਨ', welcome: 'ਇਸ ਨਵੇਂ ਅਧਿਆਇ ਦੀ ਸ਼ੁਰੂਆਤ \'ਤੇ ਤੁਹਾਡੀ ਹਾਜ਼ਰੀ ਸਾਡੇ ਲਈ ਮਾਣ ਵਾਲੀ ਗੱਲ ਹੋਵੇਗੀ।', thankyou: 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਹਾਜ਼ਰੀ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ। ਅਸੀਂ ਤੁਹਾਡੀ ਉਡੀਕ ਵਿੱਚ ਹਾਂ।' },
        royal: { familyName: 'ਪੁਰਖਿਆਂ ਦੇ ਅਸ਼ੀਰਵਾਦ ਨਾਲ', subtitle: 'ਸ਼ਾਨਦਾਰ {occasion} ਵਿੱਚ ਤੁਹਾਡੀ ਹਾਜ਼ਰੀ ਦੀ ਬੇਨਤੀ ਕਰਦੇ ਹਨ', welcome: 'ਰਵਾਇਤ, ਸੰਗੀਤ ਅਤੇ ਸ਼ਾਨ ਨਾਲ ਭਰੀ ਇਸ ਸ਼ਾਮ ਲਈ ਪਰਿਵਾਰ ਤੁਹਾਨੂੰ ਖ਼ੁਸ਼ੀ ਨਾਲ ਸੱਦਾ ਦਿੰਦੇ ਹਨ।', thankyou: 'ਤੁਹਾਡੀ ਹਾਜ਼ਰੀ ਇਸ ਮੌਕੇ ਦੀ ਸ਼ਾਨ ਵਧਾਏਗੀ।' },
      },
      party: {
        fun: { familyName: 'ਆਓ ਜਸ਼ਨ ਮਨਾਈਏ!', subtitle: 'ਤੁਹਾਨੂੰ {occasion} ਦਾ ਸੱਦਾ ਹੈ!', welcome: 'ਸੁਆਦੀ ਖਾਣਾ, ਖੇਡਾਂ ਅਤੇ ਢੇਰ ਸਾਰੀ ਮਸਤੀ ਤੁਹਾਡੀ ਉਡੀਕ ਕਰ ਰਹੀ ਹੈ। ਤੁਹਾਡੇ ਬਿਨਾਂ ਪਾਰਟੀ ਅਧੂਰੀ ਹੈ!', thankyou: 'ਇਸ ਦਿਨ ਨੂੰ ਖ਼ਾਸ ਬਣਾਉਣ ਲਈ ਧੰਨਵਾਦ!' },
        warm: { familyName: 'ਪਿਆਰ ਸਹਿਤ', subtitle: 'ਕਿਰਪਾ ਕਰਕੇ ਸਾਡੇ {occasion} ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਵੋ', welcome: 'ਇਹ ਖ਼ਾਸ ਦਿਨ ਅਸੀਂ ਉਹਨਾਂ ਨਾਲ ਮਨਾਉਣਾ ਚਾਹੁੰਦੇ ਹਾਂ ਜੋ ਸਾਡੇ ਸਭ ਤੋਂ ਨੇੜੇ ਹਨ।', thankyou: 'ਤੁਹਾਡੀ ਹਾਜ਼ਰੀ ਹੀ ਸਭ ਤੋਂ ਵਧੀਆ ਤੋਹਫ਼ਾ ਹੈ।' },
        simple: { familyName: 'ਤਾਰੀਖ਼ ਯਾਦ ਰੱਖੋ', subtitle: 'ਤੁਹਾਨੂੰ {occasion} ਦਾ ਸੱਦਾ ਹੈ', welcome: 'ਤੁਹਾਡੇ ਆਉਣ ਨਾਲ ਸਾਨੂੰ ਖ਼ੁਸ਼ੀ ਹੋਵੇਗੀ।', thankyou: 'ਤੁਹਾਨੂੰ ਮਿਲਣ ਦੀ ਉਮੀਦ ਹੈ।' },
      },
      sacred: {
        devotional: { familyName: 'ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ', subtitle: 'ਪਵਿੱਤਰ {occasion} ਵਿੱਚ ਤੁਹਾਨੂੰ ਨਿਮਰਤਾ ਸਹਿਤ ਸੱਦਾ ਦਿੰਦੇ ਹਨ', welcome: 'ਅਸੀਂ ਹੱਥ ਜੋੜ ਕੇ ਤੁਹਾਡਾ ਅਤੇ ਤੁਹਾਡੇ ਪਰਿਵਾਰ ਦਾ ਇਸ ਪਵਿੱਤਰ ਮੌਕੇ \'ਤੇ ਅਰਦਾਸ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਣ ਲਈ ਸਵਾਗਤ ਕਰਦੇ ਹਾਂ।', thankyou: 'ਵਾਹਿਗੁਰੂ ਤੁਹਾਡੇ ਪਰਿਵਾਰ \'ਤੇ ਸਦਾ ਮਿਹਰ ਕਰੇ।' },
        traditional: { familyName: 'ਪ੍ਰਭੂ ਦੀ ਕਿਰਪਾ ਨਾਲ', subtitle: 'ਤੁਹਾਨੂੰ ਪਰਿਵਾਰ ਸਮੇਤ {occasion} ਵਿੱਚ ਸੱਦਾ ਦਿੰਦੇ ਹਨ', welcome: 'ਤੁਹਾਡੀ ਹਾਜ਼ਰੀ ਨਾਲ ਇਹ ਸ਼ੁਭ ਦਿਨ ਪੂਰਾ ਹੋਵੇਗਾ।', thankyou: 'ਤੁਹਾਡੇ ਅਸ਼ੀਰਵਾਦ ਅਤੇ ਸ਼ੁਭਕਾਮਨਾਵਾਂ ਲਈ ਦਿਲੋਂ ਧੰਨਵਾਦ।' },
        warm: { familyName: 'ਖ਼ੁਸ਼ੀ ਦੇ ਨਾਲ', subtitle: 'ਸਾਡੇ {occasion} ਵਿੱਚ ਤੁਹਾਨੂੰ ਦੇਖਣਾ ਚਾਹੁੰਦੇ ਹਨ', welcome: 'ਆਓ, ਸਾਡੇ ਜਸ਼ਨ ਦਾ ਹਿੱਸਾ ਬਣੋ ਅਤੇ ਸਾਡੇ ਨਾਲ ਭੋਜਨ ਕਰੋ।', thankyou: 'ਸਾਡੇ ਨਾਲ ਜਸ਼ਨ ਮਨਾਉਣ ਲਈ ਧੰਨਵਾਦ।' },
      },
      corp: {
        formal: { familyName: 'ਖ਼ਾਸ ਸੱਦਾ', subtitle: 'ਤੁਹਾਨੂੰ {occasion} ਵਿੱਚ ਸਤਿਕਾਰ ਸਹਿਤ ਸੱਦਾ ਹੈ', welcome: 'ਵਿਚਾਰਾਂ ਅਤੇ ਗੱਲਬਾਤ ਨਾਲ ਭਰੇ ਦਿਨ ਵਿੱਚ ਤੁਹਾਡਾ ਸਵਾਗਤ ਹੈ।', thankyou: 'ਧੰਨਵਾਦ। ਅਸੀਂ ਤੁਹਾਨੂੰ ਮਿਲਣ ਦੀ ਉਡੀਕ ਵਿੱਚ ਹਾਂ।' },
        friendly: { familyName: 'ਤਾਰੀਖ਼ ਯਾਦ ਰੱਖੋ', subtitle: 'ਸਾਡੇ {occasion} ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਵੋ', welcome: 'ਸਾਥੀਆਂ ਨੂੰ ਮਿਲੋ, ਵਿਚਾਰ ਸਾਂਝੇ ਕਰੋ ਅਤੇ ਇੱਕ ਵਧੀਆ ਦਿਨ ਇਕੱਠੇ ਬਿਤਾਓ।', thankyou: 'ਉੱਥੇ ਮਿਲਦੇ ਹਾਂ!' },
      },
    },
  };

  const FIELDS = ['familyName', 'subtitle', 'welcome', 'thankyou', 'message'];
  const groupOf = (category) => GROUP[category] || 'party';
  const occasionOf = (category, lang) => {
    const cat = (window.IXT && IXT.CATEGORIES.find((c) => c.id === category)) || { occasion: {} };
    return cat.occasion[lang] || cat.occasion.en || '';
  };

  /** Tones available for an event type: [{ id, label }] */
  function tones(category, lang = 'en') {
    const L = LABEL[lang] || LABEL.en;
    return TONES[groupOf(category)].map((id) => ({ id, label: L[id] || LABEL.en[id] }));
  }

  /** The complete, matching wording for one tone: { familyName, subtitle, welcome, thankyou, message(html) } */
  function build(category, lang, tone, { host = '', title = '' } = {}) {
    const g = groupOf(category);
    const set = ((SETS[lang] || SETS.en)[g] || {})[tone] || SETS.en[g][TONES[g][0]];
    const occ = occasionOf(category, lang);
    const out = {};
    ['familyName', 'subtitle', 'welcome', 'thankyou'].forEach((k) => (out[k] = set[k].replace('{occasion}', occ)));
    const style = (g === 'corp' ? MSG_STYLE_CORP[tone] : MSG_STYLE[tone]) || 'formal';
    out.message = window.IXT ? IXT.generateMessage({ category, style, lang, host, title }) : '';
    return out;
  }

  window.IXWording = { tones, build, FIELDS, groupOf };
})();
