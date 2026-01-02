import { State } from "../models/location/state.model.js";
import { City } from "../models/location/city.model.js";

// Indian States and Union Territories with their major cities
// Includes Hindi (hi) and Kannada (kn) translations
const indianStatesAndCities = [
  {
    name: "Andhra Pradesh",
    code: "AP",
    translations: { hi: "आंध्र प्रदेश", kn: "ಆಂಧ್ರ ಪ್ರದೇಶ" },
    cities: [
      { name: "Visakhapatnam", hi: "विशाखापत्तनम", kn: "ವಿಶಾಖಪಟ್ಟಣಂ" },
      { name: "Vijayawada", hi: "विजयवाड़ा", kn: "ವಿಜಯವಾಡ" },
      { name: "Guntur", hi: "गुंटूर", kn: "ಗುಂಟೂರು" },
      { name: "Nellore", hi: "नेल्लोर", kn: "ನೆಲ್ಲೂರು" },
      { name: "Kurnool", hi: "कुर्नूल", kn: "ಕರ್ನೂಲು" },
      { name: "Rajahmundry", hi: "राजामुंदरी", kn: "ರಾಜಮಹೇಂದ್ರವರಂ" },
      { name: "Tirupati", hi: "तिरुपति", kn: "ತಿರುಪತಿ" },
      { name: "Kakinada", hi: "काकीनाडा", kn: "ಕಾಕಿನಾಡ" },
      { name: "Kadapa", hi: "कडपा", kn: "ಕಡಪ" },
      { name: "Anantapur", hi: "अनंतपुर", kn: "ಅನಂತಪುರ" },
    ],
  },
  {
    name: "Arunachal Pradesh",
    code: "AR",
    translations: { hi: "अरुणाचल प्रदेश", kn: "ಅರುಣಾಚಲ ಪ್ರದೇಶ" },
    cities: [
      { name: "Itanagar", hi: "ईटानगर", kn: "ಇಟಾನಗರ" },
      { name: "Naharlagun", hi: "नाहरलागुन", kn: "ನಾಹರ್ಲಾಗುನ್" },
      { name: "Pasighat", hi: "पासीघाट", kn: "ಪಾಸಿಘಾಟ್" },
      { name: "Tawang", hi: "तवांग", kn: "ಟವಾಂಗ್" },
      { name: "Ziro", hi: "जीरो", kn: "ಝೀರೋ" },
    ],
  },
  {
    name: "Assam",
    code: "AS",
    translations: { hi: "असम", kn: "ಅಸ್ಸಾಂ" },
    cities: [
      { name: "Guwahati", hi: "गुवाहाटी", kn: "ಗುವಾಹಾಟಿ" },
      { name: "Silchar", hi: "सिलचर", kn: "ಸಿಲ್ಚಾರ್" },
      { name: "Dibrugarh", hi: "डिब्रूगढ़", kn: "ಡಿಬ್ರೂಗಢ್" },
      { name: "Jorhat", hi: "जोरहाट", kn: "ಜೋರ್ಹಾಟ್" },
      { name: "Nagaon", hi: "नागांव", kn: "ನಾಗಾಂವ್" },
      { name: "Tinsukia", hi: "तिनसुकिया", kn: "ತಿನ್ಸುಕಿಯಾ" },
      { name: "Tezpur", hi: "तेजपुर", kn: "ತೇಜ್ಪುರ್" },
      { name: "Bongaigaon", hi: "बोंगाईगांव", kn: "ಬೊಂಗೈಗಾಂವ್" },
      { name: "Sivasagar", hi: "शिवसागर", kn: "ಶಿವಸಾಗರ್" },
      { name: "Karimganj", hi: "करीमगंज", kn: "ಕರೀಮ್‌ಗಂಜ್" },
    ],
  },
  {
    name: "Bihar",
    code: "BR",
    translations: { hi: "बिहार", kn: "ಬಿಹಾರ" },
    cities: [
      { name: "Patna", hi: "पटना", kn: "ಪಾಟ್ನಾ" },
      { name: "Gaya", hi: "गया", kn: "ಗಯಾ" },
      { name: "Bhagalpur", hi: "भागलपुर", kn: "ಭಾಗಲ್ಪುರ" },
      { name: "Muzaffarpur", hi: "मुजफ्फरपुर", kn: "ಮುಜಾಫರ್‌ಪುರ" },
      { name: "Purnia", hi: "पूर्णिया", kn: "ಪೂರ್ಣಿಯಾ" },
      { name: "Darbhanga", hi: "दरभंगा", kn: "ದರ್ಭಂಗಾ" },
      { name: "Arrah", hi: "आरा", kn: "ಆರಾ" },
      { name: "Begusarai", hi: "बेगूसराय", kn: "ಬೇಗುಸರಾಯ್" },
      { name: "Katihar", hi: "कटिहार", kn: "ಕಟಿಹಾರ್" },
      { name: "Munger", hi: "मुंगेर", kn: "ಮುಂಗೇರ್" },
    ],
  },
  {
    name: "Chhattisgarh",
    code: "CG",
    translations: { hi: "छत्तीसगढ़", kn: "ಛತ್ತೀಸ್‌ಗಢ" },
    cities: [
      { name: "Raipur", hi: "रायपुर", kn: "ರಾಯ್‌ಪುರ" },
      { name: "Bhilai", hi: "भिलाई", kn: "ಭಿಲಾಯ್" },
      { name: "Bilaspur", hi: "बिलासपुर", kn: "ಬಿಲಾಸ್‌ಪುರ" },
      { name: "Korba", hi: "कोरबा", kn: "ಕೊರ್ಬಾ" },
      { name: "Durg", hi: "दुर्ग", kn: "ದುರ್ಗ್" },
      { name: "Rajpur", hi: "राजपुर", kn: "ರಾಜ್‌ಪುರ" },
      { name: "Raigarh", hi: "रायगढ़", kn: "ರಾಯ್‌ಗಢ" },
      { name: "Jagdalpur", hi: "जगदलपुर", kn: "ಜಗದಲ್‌ಪುರ" },
      { name: "Ambikapur", hi: "अंबिकापुर", kn: "ಅಂಬಿಕಾಪುರ" },
      { name: "Dhamtari", hi: "धमतरी", kn: "ಧಮ್ತರಿ" },
    ],
  },
  {
    name: "Goa",
    code: "GA",
    translations: { hi: "गोवा", kn: "ಗೋವಾ" },
    cities: [
      { name: "Panaji", hi: "पणजी", kn: "ಪಣಜಿ" },
      { name: "Vasco da Gama", hi: "वास्को द गामा", kn: "ವಾಸ್ಕೋ ಡ ಗಾಮಾ" },
      { name: "Margao", hi: "मडगांव", kn: "ಮಡಗಾಂವ್" },
      { name: "Mapusa", hi: "मापुसा", kn: "ಮಾಪುಸಾ" },
      { name: "Ponda", hi: "पोंडा", kn: "ಪೊಂಡಾ" },
    ],
  },
  {
    name: "Gujarat",
    code: "GJ",
    translations: { hi: "गुजरात", kn: "ಗುಜರಾತ್" },
    cities: [
      { name: "Ahmedabad", hi: "अहमदाबाद", kn: "ಅಹಮದಾಬಾದ್" },
      { name: "Surat", hi: "सूरत", kn: "ಸೂರತ್" },
      { name: "Vadodara", hi: "वडोदरा", kn: "ವಡೋದರಾ" },
      { name: "Rajkot", hi: "राजकोट", kn: "ರಾಜ್‌ಕೋಟ್" },
      { name: "Bhavnagar", hi: "भावनगर", kn: "ಭಾವನಗರ" },
      { name: "Jamnagar", hi: "जामनगर", kn: "ಜಾಮನಗರ" },
      { name: "Gandhinagar", hi: "गांधीनगर", kn: "ಗಾಂಧಿನಗರ" },
      { name: "Junagadh", hi: "जूनागढ़", kn: "ಜುನಾಗಢ" },
      { name: "Gandhidham", hi: "गांधीधाम", kn: "ಗಾಂಧಿಧಾಮ್" },
      { name: "Anand", hi: "आनंद", kn: "ಆನಂದ್" },
    ],
  },
  {
    name: "Haryana",
    code: "HR",
    translations: { hi: "हरियाणा", kn: "ಹರಿಯಾಣ" },
    cities: [
      { name: "Faridabad", hi: "फरीदाबाद", kn: "ಫರಿದಾಬಾದ್" },
      { name: "Gurgaon", hi: "गुरुग्राम", kn: "ಗುರುಗ್ರಾಮ್" },
      { name: "Panipat", hi: "पानीपत", kn: "ಪಾಣಿಪತ್" },
      { name: "Ambala", hi: "अंबाला", kn: "ಅಂಬಾಲಾ" },
      { name: "Yamunanagar", hi: "यमुनानगर", kn: "ಯಮುನಾನಗರ" },
      { name: "Rohtak", hi: "रोहतक", kn: "ರೋಹ್ತಕ್" },
      { name: "Hisar", hi: "हिसार", kn: "ಹಿಸಾರ್" },
      { name: "Karnal", hi: "करनाल", kn: "ಕರ್ನಾಲ್" },
      { name: "Sonipat", hi: "सोनीपत", kn: "ಸೋನಿಪತ್" },
      { name: "Panchkula", hi: "पंचकूला", kn: "ಪಂಚಕುಲಾ" },
    ],
  },
  {
    name: "Himachal Pradesh",
    code: "HP",
    translations: { hi: "हिमाचल प्रदेश", kn: "ಹಿಮಾಚಲ ಪ್ರದೇಶ" },
    cities: [
      { name: "Shimla", hi: "शिमला", kn: "ಶಿಮ್ಲಾ" },
      { name: "Mandi", hi: "मंडी", kn: "ಮಂಡಿ" },
      { name: "Solan", hi: "सोलन", kn: "ಸೋಲನ್" },
      { name: "Dharamshala", hi: "धर्मशाला", kn: "ಧರ್ಮಶಾಲಾ" },
      { name: "Bilaspur", hi: "बिलासपुर", kn: "ಬಿಲಾಸ್‌ಪುರ" },
      { name: "Kullu", hi: "कुल्लू", kn: "ಕುಲ್ಲು" },
      { name: "Chamba", hi: "चंबा", kn: "ಚಂಬಾ" },
      { name: "Una", hi: "ऊना", kn: "ಊನಾ" },
      { name: "Hamirpur", hi: "हमीरपुर", kn: "ಹಮೀರ್‌ಪುರ" },
      { name: "Nahan", hi: "नाहन", kn: "ನಾಹನ್" },
    ],
  },
  {
    name: "Jharkhand",
    code: "JH",
    translations: { hi: "झारखंड", kn: "ಜಾರ್ಖಂಡ್" },
    cities: [
      { name: "Ranchi", hi: "रांची", kn: "ರಾಂಚಿ" },
      { name: "Jamshedpur", hi: "जमशेदपुर", kn: "ಜಮ್ಶೆಡ್‌ಪುರ" },
      { name: "Dhanbad", hi: "धनबाद", kn: "ಧನ್‌ಬಾದ್" },
      { name: "Bokaro", hi: "बोकारो", kn: "ಬೊಕಾರೋ" },
      { name: "Hazaribagh", hi: "हजारीबाग", kn: "ಹಜಾರಿಬಾಗ್" },
      { name: "Deoghar", hi: "देवघर", kn: "ದೇವಘರ್" },
      { name: "Giridih", hi: "गिरिडीह", kn: "ಗಿರಿಡೀಹ್" },
      { name: "Ramgarh", hi: "रामगढ़", kn: "ರಾಮ್‌ಗಢ" },
      { name: "Medininagar", hi: "मेदिनीनगर", kn: "ಮೆದಿನಿನಗರ" },
      { name: "Chaibasa", hi: "चाईबासा", kn: "ಚೈಬಾಸಾ" },
    ],
  },
  {
    name: "Karnataka",
    code: "KA",
    translations: { hi: "कर्नाटक", kn: "ಕರ್ನಾಟಕ" },
    cities: [
      { name: "Bangalore", hi: "बेंगलुरु", kn: "ಬೆಂಗಳೂರು" },
      { name: "Mysore", hi: "मैसूर", kn: "ಮೈಸೂರು" },
      { name: "Hubli", hi: "हुबली", kn: "ಹುಬ್ಬಳ್ಳಿ" },
      { name: "Mangalore", hi: "मंगलौर", kn: "ಮಂಗಳೂರು" },
      { name: "Belgaum", hi: "बेलगाम", kn: "ಬೆಳಗಾವಿ" },
      { name: "Gulbarga", hi: "गुलबर्गा", kn: "ಕಲಬುರಗಿ" },
      { name: "Davangere", hi: "दावणगेरे", kn: "ದಾವಣಗೆರೆ" },
      { name: "Bellary", hi: "बेल्लारी", kn: "ಬಳ್ಳಾರಿ" },
      { name: "Bijapur", hi: "बीजापुर", kn: "ವಿಜಯಪುರ" },
      { name: "Raichur", hi: "रायचूर", kn: "ರಾಯಚೂರು" },
    ],
  },
  {
    name: "Kerala",
    code: "KL",
    translations: { hi: "केरल", kn: "ಕೇರಳ" },
    cities: [
      { name: "Thiruvananthapuram", hi: "तिरुवनंतपुरम", kn: "ತಿರುವನಂತಪುರಂ" },
      { name: "Kochi", hi: "कोच्चि", kn: "ಕೊಚ್ಚಿ" },
      { name: "Kozhikode", hi: "कोझिकोड", kn: "ಕೋಳಿಕೋಡ್" },
      { name: "Thrissur", hi: "त्रिशूर", kn: "ತೃಶ್ಶೂರ್" },
      { name: "Kollam", hi: "कोल्लम", kn: "ಕೊಲ್ಲಂ" },
      { name: "Alappuzha", hi: "आलप्पुझा", kn: "ಆಲಪ್ಪುಳ" },
      { name: "Palakkad", hi: "पलक्कड़", kn: "ಪಾಲಕ್ಕಾಡ್" },
      { name: "Kannur", hi: "कन्नूर", kn: "ಕಣ್ಣೂರು" },
      { name: "Kottayam", hi: "कोट्टायम", kn: "ಕೊಟ್ಟಾಯಂ" },
      { name: "Malappuram", hi: "मलप्पुरम", kn: "ಮಲಪ್ಪುರಂ" },
    ],
  },
  {
    name: "Madhya Pradesh",
    code: "MP",
    translations: { hi: "मध्य प्रदेश", kn: "ಮಧ್ಯ ಪ್ರದೇಶ" },
    cities: [
      { name: "Bhopal", hi: "भोपाल", kn: "ಭೋಪಾಲ್" },
      { name: "Indore", hi: "इंदौर", kn: "ಇಂದೋರ್" },
      { name: "Gwalior", hi: "ग्वालियर", kn: "ಗ್ವಾಲಿಯರ್" },
      { name: "Jabalpur", hi: "जबलपुर", kn: "ಜಬಲ್ಪುರ" },
      { name: "Ujjain", hi: "उज्जैन", kn: "ಉಜ್ಜಯಿನಿ" },
      { name: "Raipur", hi: "रायपुर", kn: "ರಾಯ್‌ಪುರ" },
      { name: "Sagar", hi: "सागर", kn: "ಸಾಗರ್" },
      { name: "Ratlam", hi: "रतलाम", kn: "ರತ್ಲಾಮ್" },
      { name: "Satna", hi: "सतना", kn: "ಸತ್ನಾ" },
      { name: "Burhanpur", hi: "बुरहानपुर", kn: "ಬುರ್ಹಾನ್‌ಪುರ" },
      { name: "Dewas", hi: "देवास", kn: "ದೇವಾಸ್" },
    ],
  },
  {
    name: "Maharashtra",
    code: "MH",
    translations: { hi: "महाराष्ट्र", kn: "ಮಹಾರಾಷ್ಟ್ರ" },
    cities: [
      { name: "Mumbai", hi: "मुंबई", kn: "ಮುಂಬೈ" },
      { name: "Pune", hi: "पुणे", kn: "ಪುಣೆ" },
      { name: "Nagpur", hi: "नागपुर", kn: "ನಾಗಪುರ" },
      { name: "Thane", hi: "ठाणे", kn: "ಥಾಣೆ" },
      { name: "Nashik", hi: "नासिक", kn: "ನಾಸಿಕ್" },
      { name: "Aurangabad", hi: "औरंगाबाद", kn: "ಔರಂಗಾಬಾದ್" },
      { name: "Solapur", hi: "सोलापुर", kn: "ಸೊಲ್ಲಾಪುರ" },
      { name: "Amravati", hi: "अमरावती", kn: "ಅಮರಾವತಿ" },
      { name: "Kolhapur", hi: "कोल्हापुर", kn: "ಕೊಲ್ಹಾಪುರ" },
      { name: "Sangli", hi: "सांगली", kn: "ಸಾಂಗ್ಲಿ" },
    ],
  },
  {
    name: "Manipur",
    code: "MN",
    translations: { hi: "मणिपुर", kn: "ಮಣಿಪುರ" },
    cities: [
      { name: "Imphal", hi: "इंफाल", kn: "ಇಂಫಾಲ್" },
      { name: "Thoubal", hi: "थौबल", kn: "ಥೌಬಲ್" },
      { name: "Bishnupur", hi: "बिष्णुपुर", kn: "ಬಿಷ್ಣುಪುರ" },
      { name: "Churachandpur", hi: "चुराचांदपुर", kn: "ಚುರಾಚಾಂದ್‌ಪುರ" },
      { name: "Ukhrul", hi: "उखरूल", kn: "ಉಖ್ರುಲ್" },
    ],
  },
  {
    name: "Meghalaya",
    code: "ML",
    translations: { hi: "मेघालय", kn: "ಮೇಘಾಲಯ" },
    cities: [
      { name: "Shillong", hi: "शिलांग", kn: "ಶಿಲ್ಲಾಂಗ್" },
      { name: "Tura", hi: "तुरा", kn: "ತುರಾ" },
      { name: "Jowai", hi: "जोवाई", kn: "ಜೋವಾಯ್" },
      { name: "Nongstoin", hi: "नोंगस्तोइन", kn: "ನಾಂಗ್‌ಸ್ಟೋಯ್ನ್" },
      { name: "Williamnagar", hi: "विलियमनगर", kn: "ವಿಲಿಯಂನಗರ" },
    ],
  },
  {
    name: "Mizoram",
    code: "MZ",
    translations: { hi: "मिज़ोरम", kn: "ಮಿಜೋರಾಂ" },
    cities: [
      { name: "Aizawl", hi: "आइजोल", kn: "ಐಜಾಲ್" },
      { name: "Lunglei", hi: "लुंगलेई", kn: "ಲುಂಗ್ಲೇಯ್" },
      { name: "Saiha", hi: "सैहा", kn: "ಸೈಹಾ" },
      { name: "Champhai", hi: "चम्फाई", kn: "ಚಂಫಾಯ್" },
      { name: "Kolasib", hi: "कोलासिब", kn: "ಕೊಲಾಸಿಬ್" },
    ],
  },
  {
    name: "Nagaland",
    code: "NL",
    translations: { hi: "नागालैंड", kn: "ನಾಗಾಲ್ಯಾಂಡ್" },
    cities: [
      { name: "Kohima", hi: "कोहिमा", kn: "ಕೊಹಿಮಾ" },
      { name: "Dimapur", hi: "दीमापुर", kn: "ದಿಮಾಪುರ" },
      { name: "Mokokchung", hi: "मोकोकचुंग", kn: "ಮೋಕೋಕ್‌ಚುಂಗ್" },
      { name: "Tuensang", hi: "तुएनसांग", kn: "ತುಎನ್‌ಸಾಂಗ್" },
      { name: "Wokha", hi: "वोखा", kn: "ವೋಖಾ" },
    ],
  },
  {
    name: "Odisha",
    code: "OD",
    translations: { hi: "ओडिशा", kn: "ಒಡಿಶಾ" },
    cities: [
      { name: "Bhubaneswar", hi: "भुवनेश्वर", kn: "ಭುವನೇಶ್ವರ" },
      { name: "Cuttack", hi: "कटक", kn: "ಕಟಕ್" },
      { name: "Rourkela", hi: "राउरकेला", kn: "ರೂರ್ಕೆಲಾ" },
      { name: "Berhampur", hi: "बेरहामपुर", kn: "ಬ್ರಹ್ಮಪುರ" },
      { name: "Sambalpur", hi: "संबलपुर", kn: "ಸಂಬಲ್‌ಪುರ" },
      { name: "Puri", hi: "पुरी", kn: "ಪುರಿ" },
      { name: "Baleshwar", hi: "बालेश्वर", kn: "ಬಾಲೇಶ್ವರ" },
      { name: "Baripada", hi: "बारीपाड़ा", kn: "ಬಾರಿಪಾಡ" },
      { name: "Bhadrak", hi: "भद्रक", kn: "ಭದ್ರಕ್" },
      { name: "Jharsuguda", hi: "झारसुगुडा", kn: "ಝಾರ್ಸುಗುಡಾ" },
    ],
  },
  {
    name: "Punjab",
    code: "PB",
    translations: { hi: "पंजाब", kn: "ಪಂಜಾಬ್" },
    cities: [
      { name: "Ludhiana", hi: "लुधियाना", kn: "ಲುಧಿಯಾನಾ" },
      { name: "Amritsar", hi: "अमृतसर", kn: "ಅಮೃತಸರ" },
      { name: "Jalandhar", hi: "जालंधर", kn: "ಜಲಂಧರ" },
      { name: "Patiala", hi: "पटियाला", kn: "ಪಟಿಯಾಲಾ" },
      { name: "Bathinda", hi: "बठिंडा", kn: "ಬಠಿಂಡಾ" },
      { name: "Pathankot", hi: "पठानकोट", kn: "ಪಠಾಣ್‌ಕೋಟ್" },
      { name: "Hoshiarpur", hi: "होशियारपुर", kn: "ಹೋಶಿಯಾರ್‌ಪುರ" },
      { name: "Mohali", hi: "मोहाली", kn: "ಮೋಹಾಲಿ" },
      { name: "Batala", hi: "बटाला", kn: "ಬಟಾಲಾ" },
      { name: "Abohar", hi: "अबोहर", kn: "ಅಬೋಹರ್" },
    ],
  },
  {
    name: "Rajasthan",
    code: "RJ",
    translations: { hi: "राजस्थान", kn: "ರಾಜಸ್ಥಾನ" },
    cities: [
      { name: "Jaipur", hi: "जयपुर", kn: "ಜೈಪುರ" },
      { name: "Jodhpur", hi: "जोधपुर", kn: "ಜೋಧ್‌ಪುರ" },
      { name: "Kota", hi: "कोटा", kn: "ಕೋಟಾ" },
      { name: "Bikaner", hi: "बीकानेर", kn: "ಬಿಕಾನೇರ್" },
      { name: "Ajmer", hi: "अजमेर", kn: "ಅಜ್ಮೀರ್" },
      { name: "Udaipur", hi: "उदयपुर", kn: "ಉದಯಪುರ" },
      { name: "Bhilwara", hi: "भीलवाड़ा", kn: "ಭಿಲ್ವಾರಾ" },
      { name: "Alwar", hi: "अलवर", kn: "ಅಲ್ವಾರ್" },
      { name: "Bharatpur", hi: "भरतपुर", kn: "ಭರತ್‌ಪುರ" },
      { name: "Sikar", hi: "सीकर", kn: "ಸೀಕರ್" },
    ],
  },
  {
    name: "Sikkim",
    code: "SK",
    translations: { hi: "सिक्किम", kn: "ಸಿಕ್ಕಿಂ" },
    cities: [
      { name: "Gangtok", hi: "गंगटोक", kn: "ಗ್ಯಾಂಗ್‌ಟಾಕ್" },
      { name: "Namchi", hi: "नामची", kn: "ನಾಮ್ಚಿ" },
      { name: "Mangan", hi: "मंगन", kn: "ಮಂಗನ್" },
      { name: "Gyalshing", hi: "ग्यालशिंग", kn: "ಗ್ಯಾಲ್ಶಿಂಗ್" },
      { name: "Singtam", hi: "सिंगटाम", kn: "ಸಿಂಗ್‌ಟಾಮ್" },
    ],
  },
  {
    name: "Tamil Nadu",
    code: "TN",
    translations: { hi: "तमिलनाडु", kn: "ತಮಿಳುನಾಡು" },
    cities: [
      { name: "Chennai", hi: "चेन्नई", kn: "ಚೆನ್ನೈ" },
      { name: "Coimbatore", hi: "कोयंबटूर", kn: "ಕೊಯಮತ್ತೂರು" },
      { name: "Madurai", hi: "मदुरै", kn: "ಮಧುರೈ" },
      { name: "Tiruchirappalli", hi: "तिरुचिरापल्ली", kn: "ತಿರುಚಿರಾಪಳ್ಳಿ" },
      { name: "Salem", hi: "सलेम", kn: "ಸೇಲಂ" },
      { name: "Tirunelveli", hi: "तिरुनेलवेली", kn: "ತಿರುನೆಲ್ವೇಲಿ" },
      { name: "Erode", hi: "इरोड", kn: "ಈರೋಡ್" },
      { name: "Vellore", hi: "वेल्लोर", kn: "ವೆಲ್ಲೂರು" },
      { name: "Thanjavur", hi: "तंजावुर", kn: "ತಂಜಾವೂರು" },
      { name: "Dindigul", hi: "डिंडीगुल", kn: "ದಿಂಡಿಗಲ್" },
    ],
  },
  {
    name: "Telangana",
    code: "TS",
    translations: { hi: "तेलंगाना", kn: "ತೆಲಂಗಾಣ" },
    cities: [
      { name: "Hyderabad", hi: "हैदराबाद", kn: "ಹೈದರಾಬಾದ್" },
      { name: "Warangal", hi: "वारंगल", kn: "ವಾರಂಗಲ್" },
      { name: "Nizamabad", hi: "निजामाबाद", kn: "ನಿಜಾಮಾಬಾದ್" },
      { name: "Karimnagar", hi: "करीमनगर", kn: "ಕರೀಂನಗರ" },
      { name: "Ramagundam", hi: "रामागुंडम", kn: "ರಾಮಗುಂಡಂ" },
      { name: "Khammam", hi: "खम्मम", kn: "ಖಮ್ಮಂ" },
      { name: "Mahbubnagar", hi: "महबूबनगर", kn: "ಮಹಬೂಬ್‌ನಗರ" },
      { name: "Nalgonda", hi: "नलगोंडा", kn: "ನಲ್ಗೊಂಡ" },
      { name: "Adilabad", hi: "आदिलाबाद", kn: "ಆದಿಲಾಬಾದ್" },
      { name: "Siddipet", hi: "सिद्दीपेट", kn: "ಸಿದ್ದಿಪೇಟ" },
    ],
  },
  {
    name: "Tripura",
    code: "TR",
    translations: { hi: "त्रिपुरा", kn: "ತ್ರಿಪುರ" },
    cities: [
      { name: "Agartala", hi: "अगरतला", kn: "ಅಗರ್ತಲಾ" },
      { name: "Udaipur", hi: "उदयपुर", kn: "ಉದಯಪುರ" },
      { name: "Dharmanagar", hi: "धर्मनगर", kn: "ಧರ್ಮನಗರ" },
      { name: "Kailasahar", hi: "कैलाशहर", kn: "ಕೈಲಾಸಹರ್" },
      { name: "Belonia", hi: "बेलोनिया", kn: "ಬೆಲೋನಿಯಾ" },
    ],
  },
  {
    name: "Uttar Pradesh",
    code: "UP",
    translations: { hi: "उत्तर प्रदेश", kn: "ಉತ್ತರ ಪ್ರದೇಶ" },
    cities: [
      { name: "Lucknow", hi: "लखनऊ", kn: "ಲಕ್ನೋ" },
      { name: "Kanpur", hi: "कानपुर", kn: "ಕಾನ್ಪುರ" },
      { name: "Agra", hi: "आगरा", kn: "ಆಗ್ರಾ" },
      { name: "Meerut", hi: "मेरठ", kn: "ಮೀರತ್" },
      { name: "Varanasi", hi: "वाराणसी", kn: "ವಾರಾಣಸಿ" },
      { name: "Allahabad", hi: "इलाहाबाद", kn: "ಅಲಹಾಬಾದ್" },
      { name: "Bareilly", hi: "बरेली", kn: "ಬರೇಲಿ" },
      { name: "Aligarh", hi: "अलीगढ़", kn: "ಅಲಿಗಢ" },
      { name: "Moradabad", hi: "मुरादाबाद", kn: "ಮುರಾದಾಬಾದ್" },
      { name: "Saharanpur", hi: "सहारनपुर", kn: "ಸಹಾರನ್‌ಪುರ" },
    ],
  },
  {
    name: "Uttarakhand",
    code: "UT",
    translations: { hi: "उत्तराखंड", kn: "ಉತ್ತರಾಖಂಡ" },
    cities: [
      { name: "Dehradun", hi: "देहरादून", kn: "ದೆಹ್ರಾದೂನ್" },
      { name: "Haridwar", hi: "हरिद्वार", kn: "ಹರಿದ್ವಾರ" },
      { name: "Roorkee", hi: "रुड़की", kn: "ರೂರ್ಕಿ" },
      { name: "Haldwani", hi: "हल्द्वानी", kn: "ಹಲ್ದ್ವಾನಿ" },
      { name: "Rudrapur", hi: "रुद्रपुर", kn: "ರುದ್ರಪುರ" },
      { name: "Kashipur", hi: "काशीपुर", kn: "ಕಾಶೀಪುರ" },
      { name: "Rishikesh", hi: "ऋषिकेश", kn: "ಋಷಿಕೇಶ" },
      { name: "Nainital", hi: "नैनीताल", kn: "ನೈನಿತಾಲ್" },
      { name: "Almora", hi: "अल्मोड़ा", kn: "ಅಲ್ಮೋರಾ" },
      { name: "Pithoragarh", hi: "पिथौरागढ़", kn: "ಪಿಥೋರಾಗಢ" },
    ],
  },
  {
    name: "West Bengal",
    code: "WB",
    translations: { hi: "पश्चिम बंगाल", kn: "ಪಶ್ಚಿಮ ಬಂಗಾಳ" },
    cities: [
      { name: "Kolkata", hi: "कोलकाता", kn: "ಕೊಲ್ಕತ್ತಾ" },
      { name: "Howrah", hi: "हावड़ा", kn: "ಹೌರಾ" },
      { name: "Durgapur", hi: "दुर्गापुर", kn: "ದುರ್ಗಾಪುರ" },
      { name: "Asansol", hi: "आसनसोल", kn: "ಆಸನ್ಸೋಲ್" },
      { name: "Siliguri", hi: "सिलीगुड़ी", kn: "ಸಿಲಿಗುರಿ" },
      { name: "Bardhaman", hi: "बर्धमान", kn: "ಬರ್ಧಮಾನ್" },
      { name: "Malda", hi: "मालदा", kn: "ಮಾಲ್ಡಾ" },
      { name: "Kharagpur", hi: "खड़गपुर", kn: "ಖರಗ್‌ಪುರ" },
      { name: "Krishnanagar", hi: "कृष्णनगर", kn: "ಕೃಷ್ಣನಗರ" },
      { name: "Jalpaiguri", hi: "जलपाईगुड़ी", kn: "ಜಲ್ಪಾಯ್‌ಗುರಿ" },
    ],
  },
  // Union Territories
  {
    name: "Andaman and Nicobar Islands",
    code: "AN",
    translations: { hi: "अंडमान और निकोबार द्वीपसमूह", kn: "ಅಂಡಮಾನ್ ಮತ್ತು ನಿಕೋಬಾರ್ ದ್ವೀಪಗಳು" },
    cities: [
      { name: "Port Blair", hi: "पोर्ट ब्लेयर", kn: "ಪೋರ್ಟ್ ಬ್ಲೇರ್" },
      { name: "Diglipur", hi: "दिगलीपुर", kn: "ಡಿಗ್ಲಿಪುರ" },
      { name: "Mayabunder", hi: "मायाबंदर", kn: "ಮಾಯಾಬಂದರ್" },
      { name: "Rangat", hi: "रंगत", kn: "ರಂಗತ್" },
      { name: "Car Nicobar", hi: "कार निकोबार", kn: "ಕಾರ್ ನಿಕೋಬಾರ್" },
    ],
  },
  {
    name: "Chandigarh",
    code: "CH",
    translations: { hi: "चंडीगढ़", kn: "ಚಂಡೀಗಢ" },
    cities: [{ name: "Chandigarh", hi: "चंडीगढ़", kn: "ಚಂಡೀಗಢ" }],
  },
  {
    name: "Dadra and Nagar Haveli and Daman and Diu",
    code: "DH",
    translations: { hi: "दादरा और नगर हवेली और दमन और दीव", kn: "ದಾದ್ರಾ ಮತ್ತು ನಗರ್ ಹವೇಲಿ ಮತ್ತು ದಮನ್ ಮತ್ತು ದಿಯು" },
    cities: [
      { name: "Daman", hi: "दमन", kn: "ದಮನ್" },
      { name: "Diu", hi: "दीव", kn: "ದಿಯು" },
      { name: "Silvassa", hi: "सिलवासा", kn: "ಸಿಲ್ವಾಸಾ" },
    ],
  },
  {
    name: "Delhi",
    code: "DL",
    translations: { hi: "दिल्ली", kn: "ದೆಹಲಿ" },
    cities: [
      { name: "New Delhi", hi: "नई दिल्ली", kn: "ನವ ದೆಹಲಿ" },
      { name: "Delhi", hi: "दिल्ली", kn: "ದೆಹಲಿ" },
      { name: "North Delhi", hi: "उत्तर दिल्ली", kn: "ಉತ್ತರ ದೆಹಲಿ" },
      { name: "South Delhi", hi: "दक्षिण दिल्ली", kn: "ದಕ್ಷಿಣ ದೆಹಲಿ" },
      { name: "East Delhi", hi: "पूर्वी दिल्ली", kn: "ಪೂರ್ವ ದೆಹಲಿ" },
      { name: "West Delhi", hi: "पश्चिम दिल्ली", kn: "ಪಶ್ಚಿಮ ದೆಹಲಿ" },
      { name: "Central Delhi", hi: "मध्य दिल्ली", kn: "ಮಧ್ಯ ದೆಹಲಿ" },
      { name: "Noida", hi: "नोएडा", kn: "ನೋಯ್ಡಾ" },
      { name: "Gurgaon", hi: "गुरुग्राम", kn: "ಗುರುಗ್ರಾಮ್" },
      { name: "Faridabad", hi: "फरीदाबाद", kn: "ಫರಿದಾಬಾದ್" },
    ],
  },
  {
    name: "Jammu and Kashmir",
    code: "JK",
    translations: { hi: "जम्मू और कश्मीर", kn: "ಜಮ್ಮು ಮತ್ತು ಕಾಶ್ಮೀರ" },
    cities: [
      { name: "Srinagar", hi: "श्रीनगर", kn: "ಶ್ರೀನಗರ" },
      { name: "Jammu", hi: "जम्मू", kn: "ಜಮ್ಮು" },
      { name: "Anantnag", hi: "अनंतनाग", kn: "ಅನಂತನಾಗ್" },
      { name: "Baramulla", hi: "बारामूला", kn: "ಬಾರಮುಲ್ಲಾ" },
      { name: "Sopore", hi: "सोपोर", kn: "ಸೋಪೋರ್" },
      { name: "Kathua", hi: "कठुआ", kn: "ಕಠುವಾ" },
      { name: "Udhampur", hi: "उधमपुर", kn: "ಉಧಂಪುರ" },
      { name: "Poonch", hi: "पुंछ", kn: "ಪೂಂಚ್" },
      { name: "Rajouri", hi: "राजौरी", kn: "ರಾಜೌರಿ" },
      { name: "Kupwara", hi: "कुपवाड़ा", kn: "ಕುಪ್ವಾರಾ" },
    ],
  },
  {
    name: "Ladakh",
    code: "LA",
    translations: { hi: "लद्दाख", kn: "ಲಡಾಖ್" },
    cities: [
      { name: "Leh", hi: "लेह", kn: "ಲೇಹ್" },
      { name: "Kargil", hi: "कारगिल", kn: "ಕಾರ್ಗಿಲ್" },
    ],
  },
  {
    name: "Lakshadweep",
    code: "LD",
    translations: { hi: "लक्षद्वीप", kn: "ಲಕ್ಷದ್ವೀಪ" },
    cities: [
      { name: "Kavaratti", hi: "कवरत्ती", kn: "ಕವರತ್ತಿ" },
      { name: "Agatti", hi: "अगत्ती", kn: "ಅಗತ್ತಿ" },
      { name: "Amini", hi: "अमिनी", kn: "ಅಮಿನಿ" },
      { name: "Andrott", hi: "अंद्रोट", kn: "ಆಂಡ್ರೋಟ್" },
      { name: "Kadmat", hi: "कदमत", kn: "ಕದ್ಮತ್" },
    ],
  },
  {
    name: "Puducherry",
    code: "PY",
    translations: { hi: "पुडुचेरी", kn: "ಪುದುಚ್ಚೇರಿ" },
    cities: [
      { name: "Puducherry", hi: "पुडुचेरी", kn: "ಪುದುಚ್ಚೇರಿ" },
      { name: "Karaikal", hi: "कराईकल", kn: "ಕಾರೈಕಲ್" },
      { name: "Mahe", hi: "माहे", kn: "ಮಾಹೆ" },
      { name: "Yanam", hi: "यनम", kn: "ಯಾನಂ" },
    ],
  },
];

export const seedStatesAndCities = async () => {
  try {
    console.log("🌱 Starting to seed States and Cities with translations...");

    for (const stateData of indianStatesAndCities) {
      // Create or update state
      let state = await State.findOne({ code: stateData.code });

      if (!state) {
        state = await State.create({
          name: stateData.name,
          code: stateData.code,
          translations: stateData.translations || {},
          status: "Active",
        });
        console.log(`✅ State created: ${stateData.name} (hi: ${stateData.translations?.hi}, kn: ${stateData.translations?.kn})`);
      } else {
        // Update if name changed or translations missing
        let needsUpdate = false;
        if (state.name !== stateData.name) {
          state.name = stateData.name;
          needsUpdate = true;
        }
        // Update translations if they don't exist
        if (stateData.translations) {
          if (!state.translations) state.translations = {};
          if (!state.translations.hi && stateData.translations.hi) {
            state.translations.hi = stateData.translations.hi;
            needsUpdate = true;
          }
          if (!state.translations.kn && stateData.translations.kn) {
            state.translations.kn = stateData.translations.kn;
            needsUpdate = true;
          }
        }
        if (needsUpdate) {
          await state.save();
          console.log(`ℹ️ State updated: ${stateData.name}`);
        }
      }

      // Create or update cities for this state
      for (const cityData of stateData.cities) {
        const cityName = typeof cityData === "string" ? cityData : cityData.name;
        const cityTranslations = typeof cityData === "object" ? { hi: cityData.hi, kn: cityData.kn } : {};

        const existingCity = await City.findOne({
          name: cityName,
          stateId: state._id,
        });

        if (!existingCity) {
          await City.create({
            name: cityName,
            stateId: state._id,
            stateName: stateData.name,
            translations: cityTranslations,
            status: "Active",
          });
          console.log(`  ✅ City created: ${cityName} (hi: ${cityTranslations.hi}, kn: ${cityTranslations.kn})`);
        } else {
          // Update translations if missing
          let cityNeedsUpdate = false;
          if (!existingCity.translations) existingCity.translations = {};
          if (!existingCity.translations.hi && cityTranslations.hi) {
            existingCity.translations.hi = cityTranslations.hi;
            cityNeedsUpdate = true;
          }
          if (!existingCity.translations.kn && cityTranslations.kn) {
            existingCity.translations.kn = cityTranslations.kn;
            cityNeedsUpdate = true;
          }
          if (cityNeedsUpdate) {
            await existingCity.save();
            console.log(`  ℹ️ City updated: ${cityName} (added translations)`);
          }
        }
      }
    }

    const totalStates = await State.countDocuments();
    const totalCities = await City.countDocuments();

    console.log(`\n✅ States and Cities seeding completed!`);
    console.log(`   Total States: ${totalStates}`);
    console.log(`   Total Cities: ${totalCities}`);
  } catch (error) {
    console.error("❌ Error seeding states and cities:", error);
    throw error;
  }
};
