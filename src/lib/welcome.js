/*
  الشاشة الترحيبية «دليل التطبيق» (٢٠٢٦-١١-٢٣، بقرار صاحب المشروع): ست شرائح تعرّف بالتطبيق وأهم أماكنه
  بلقطات حقيقية منه (فاتحة وداكنة، ولكل مقاس لقطته)، تظهر مرة واحدة عند أول فتح للمستخدم الجديد، وتُفتح
  متى شاء من زرّ «دليل التطبيق» في الإعدادات ← «عن التطبيق» (لا سطرًا في الإعدادات نفسها، لئلا
  تطول اللوحة عن شاشة الجوال).

  من هو المستخدم الجديد؟ من لا مفتاح «hq.» عنده أصلًا عند أول تحميل للصفحة. يفحص ذلك سكربت index.html قبل أن
  يكتب المظهر الافتراضي، فيكتب hq.welcome = 'show'. ومستخدمو الويب القدامى (عندهم بيانات) لا يُكتب لهم شيء
  فلا تظهر لهم تلقائيًّا (بقرار صاحب المشروع). وإتمامها بـ«ابدأ» أو «تخطٍّ» يكتب 'seen' فلا تعود.

  اللقطات في public/welcome/<id>-<mobile|laptop>-<light|dark>.webp، ويعيد التقاطها أمر واحد:
  npm run build ثم node scripts/welcome-shots.mjs
*/

export const WELCOME_KEY = 'hq.welcome';

export const SLIDES = [
  {
    id: 'hello',
    title: 'أهلًا بك في قرآن السلف',
    text: 'مصحف المدينة كاملًا للقراءة والاستماع، ومعه التفسير ومعاني الكلمات والعمل بالآيات والفوائد؛ لتتلقّى القرآن علمًا وعملًا كما تلقّاه السلف.',
    shot: false,
  },
  {
    id: 'mushaf',
    title: 'المصحف',
    text: 'اسحب الصفحة لتقلّبها، واضغط مطوّلًا على أي آية ليفتح مربعها: التفسير، والعلامة، والملاحظة، والاستماع، والمشاركة.',
    shot: true,
  },
  {
    id: 'study',
    title: 'صفحات المحتوى',
    text: 'من الزرّ السفلي: التفسير، ومعاني الكلمات، والعمل بالآيات، والفوائد، للصفحة الظاهرة أو لأي مقدار تختاره.',
    shot: true,
  },
  {
    id: 'menu',
    title: 'القائمة اليمنى',
    text: 'ختمة الورد اليومي وختمة الحفظ، وفهرس السور والأجزاء، وعلاماتك وملاحظاتك على الآيات.',
    shot: true,
  },
  {
    id: 'listen',
    title: 'الاستماع',
    text: 'أكثر من ثلاثين قارئًا، مع تكرار الآية أو المقدار، ومؤقّت للتلاوة، وتنزيل التلاوة للاستماع بلا إنترنت.',
    shot: true,
  },
  {
    id: 'settings',
    title: 'الإعدادات',
    text: 'من الأيقونة اليسرى: المظهر بخلفيته ولونه، ووضع القراءة، ووضع التسميع، والرواية (حفص أو ورش)، والنسخة الاحتياطية.',
    note: 'تجد هذا الدليل متى أردت في الإعدادات، في «عن التطبيق».',
    shot: true,
  },
];

// رابط لقطة الشريحة بحسب المقاس (laptop: عرض الصفحتين) ونوع الخلفية (light أو dark)
export function shotUrl(id, laptop, theme, base = '/') {
  return `${base}welcome/${id}-${laptop ? 'laptop' : 'mobile'}-${theme === 'dark' ? 'dark' : 'light'}.webp`;
}

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// أتظهر الشاشة الترحيبية الآن تلقائيًّا؟ (للمستخدم الجديد وحده، ما لم يتمّها)
export function shouldShowWelcome(store = storage()) {
  try {
    return store?.getItem(WELCOME_KEY) === 'show';
  } catch {
    return false;
  }
}

// أتمّها المستخدم (ابدأ أو تخطٍّ): لا تظهر بعدُ تلقائيًّا
export function markWelcomeSeen(store = storage()) {
  try {
    store?.setItem(WELCOME_KEY, 'seen');
  } catch {
    // بلا تخزين: تظهر في الفتح التالي مرة أخرى، ولا ضرر
  }
}

// ما يفعله سكربت index.html قبل كتابة أي شيء: إن لم يكن عند المستخدم أي مفتاح «hq.» فهو جديد
export function detectNewUser(store = storage()) {
  try {
    if (!store) return false;
    for (let i = 0; i < store.length; i++) if ((store.key(i) || '').startsWith('hq.')) return false;
    store.setItem(WELCOME_KEY, 'show');
    return true;
  } catch {
    return false;
  }
}

// الشريحة التالية أو السابقة ضمن الحدود
export const clampSlide = (i) => Math.max(0, Math.min(SLIDES.length - 1, i));
