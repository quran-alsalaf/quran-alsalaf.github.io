// القرّاء (الفصل ٦): كل قارئ سطر واحد، فيُضاف قارئ جديد بسطر — بشرط توفّر ملف مستقل لكل آية
// له (من everyayah.com)، لا ملف سورة كامل. ثلاثة قرّاء نصّت عليهم المواصفة الأصلية (أحمد
// النفيس، عبد الله البعيجان، أحمد بن طالب) أُلغوا ٢٠٢٦-٠٩-٢٢ لعدم توفّر ملفات آية بآية لهم في
// أي مصدر (بحث مفصَّل: everyayah.com/alquran.cloud بـ١٧٦ إصدارًا صوتيًّا، وقائمة quran.com
// المعتمدة، ومرايا أحمد بن طالب على مواقع أخرى — كلها تعيد بثّ ملف mp3quran للسورة كاملة
// نفسه لا ملفات آية بآية). فبقي القارئ الأصيل، ولا آلية «ملف سورة» في التطبيق الآن.
export const RECITERS = [
  { id: 'shuraym', name: 'سعود الشريم', folder: 'Saood_ash-Shuraym_128kbps' },
  { id: 'ayyoub', name: 'محمد أيوب', folder: 'Muhammad_Ayyoub_128kbps' },
  { id: 'minshawi', name: 'محمد صديق المنشاوي', folder: 'Minshawy_Murattal_128kbps' },
  { id: 'husary', name: 'محمود خليل الحصري', folder: 'Husary_128kbps' },
  { id: 'dosari', name: 'ياسر الدوسري', folder: 'Yasser_Ad-Dussary_128kbps' },
  { id: 'muaiqly', name: 'ماهر المعيقلي', folder: 'MaherAlMuaiqly128kbps' },
  { id: 'shatri', name: 'أبو بكر الشاطري', folder: 'Abu_Bakr_Ash-Shaatree_128kbps' },
  { id: 'akhdar', name: 'إبراهيم الأخضر', folder: 'Ibrahim_Akhdar_32kbps' },
  { id: 'abdulbasit', name: 'عبد الباسط عبد الصمد', folder: 'Abdul_Basit_Murattal_64kbps' },
  { id: 'afasy', name: 'مشاري العفاسي', folder: 'Alafasy_128kbps' },
  { id: 'qatami', name: 'ناصر القطامي', folder: 'Nasser_Alqatami_128kbps' },
  { id: 'hudhaify', name: 'علي الحذيفي', folder: 'Hudhaify_128kbps' },
  { id: 'juhany', name: 'عبد الله الجهني', folder: 'Abdullaah_3awwaad_Al-Juhaynee_128kbps' },
  { id: 'matroud', name: 'عبد الله المطرود', folder: 'Abdullah_Matroud_128kbps' },
  { id: 'jaber', name: 'علي جابر', folder: 'Ali_Jaber_64kbps' },
  { id: 'ghamdi', name: 'سعد الغامدي', folder: 'Ghamadi_40kbps' },
];

export const reciterById = (id) => RECITERS.find((r) => r.id === id) ?? RECITERS[0];

const pad = (n) => String(n).padStart(3, '0');
export const ayahUrl = (r, s, a) => `https://everyayah.com/data/${r.folder}/${pad(s)}${pad(a)}.mp3`;

// هل يشمل تسجيل القارئ كل هذه السور؟ (كل القرّاء الآن كاملون، فتبقى الدالة للتوسّع لاحقًا)
export const covers = (r, suras) => !r.missing || suras.every((s) => !r.missing.includes(s));
