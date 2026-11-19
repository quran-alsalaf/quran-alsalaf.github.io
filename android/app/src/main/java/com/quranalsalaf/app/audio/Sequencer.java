package com.quranalsalaf.app.audio;

import java.util.List;

/**
 * ترتيب التلاوة (الجلسة ٢ من التطبيق الأصلي، ٢٠٢٦-١١-١٨): أيّ ملف يُقرأ بعد أيّ ملف.
 *
 * نقلٌ حرفيّ لمنطق مشغّل الموقع (src/lib/player.js: startVerse وsegmentDone وskip)، بلا شيء من أندرويد،
 * فيُختبر وحده (app/src/test) على الحالات نفسها التي يُختبر بها مشغّل الموقع (tests/fixtures/sequence.json).
 *
 *   • المقدار «مقاطع» (Item): آيات الملف الواحد معًا، ولكل مقطع ملف أو أكثر بالترتيب، وبسملة قبله إن كان أول سورته
 *   • قبل أول قراءة للمقطع تُقرأ البسملة (لا عند تكرار الآية، وتعود عند تكرار المقدار)
 *   • تكرار الآية verseRepeat مرة، ثم التالي؛ وفي آخر المقدار يُعاد rangeRepeat مرة (٠ = بلا نهاية)
 *   • continuous: استماع بلا مقدار (من الصفحة إلى آخر المصحف): لا تكرار للمقدار، ويقف في آخره
 *   • السابق والتالي (من الإشعار وشاشة القفل): مقطعًا مقطعًا، دائريًّا في المقدار، من أوله وببسملته
 */
public final class Sequencer {

    /** مقطع من المقدار: ملفاته بالترتيب، وبسملته (أو null). */
    public static final class Item {
        public final String[] files;
        public final String basmala;

        public Item(String[] files, String basmala) {
            this.files = files;
            this.basmala = basmala;
        }
    }

    /** موضع القراءة: المقطع pos، والملف part منه (BASMALA للبسملة)، وعدّادا تكرار الآية والمقدار. */
    public static final class Cursor {
        public final int pos;
        public final int part;
        public final int verseRep;
        public final int rangeRep;

        public Cursor(int pos, int part, int verseRep, int rangeRep) {
            this.pos = pos;
            this.part = part;
            this.verseRep = verseRep;
            this.rangeRep = rangeRep;
        }

        public boolean isBasmala() {
            return part == BASMALA;
        }

        @Override
        public boolean equals(Object o) {
            if (!(o instanceof Cursor)) return false;
            Cursor c = (Cursor) o;
            return c.pos == pos && c.part == part && c.verseRep == verseRep && c.rangeRep == rangeRep;
        }

        @Override
        public int hashCode() {
            return ((pos * 31 + part) * 31 + verseRep) * 31 + rangeRep;
        }

        @Override
        public String toString() {
            return "Cursor(" + pos + "," + part + "," + verseRep + "," + rangeRep + ")";
        }
    }

    public static final int BASMALA = -1;
    /** تكرار المقدار بلا نهاية (FOREVER في src/lib/player.js). */
    public static final int FOREVER = 0;

    public final List<Item> items;
    public int verseRepeat;
    public int rangeRepeat;
    public boolean continuous;

    public Sequencer(List<Item> items, int verseRepeat, int rangeRepeat, boolean continuous) {
        this.items = items;
        this.verseRepeat = verseRepeat;
        this.rangeRepeat = rangeRepeat;
        this.continuous = continuous;
    }

    /** أول ما يُقرأ من المقطع pos (startVerse): البسملة إن طُلبت وكانت هذه أول قراءة له، وإلا أول ملفاته. */
    public Cursor start(int pos, int verseRep, int rangeRep, boolean withBasmala) {
        boolean basmala = withBasmala && verseRep == 0 && items.get(pos).basmala != null;
        return new Cursor(pos, basmala ? BASMALA : 0, verseRep, rangeRep);
    }

    /** ما يُقرأ بعد انتهاء c (segmentDone، بلا مؤقّت التلاوة)، أو null إذا انتهت التلاوة. */
    public Cursor advance(Cursor c) {
        // بعد البسملة: الآية نفسها
        if (c.isBasmala()) return new Cursor(c.pos, 0, c.verseRep, c.rangeRep);
        // ملف المقطع التالي إن بقي له ملف (آية ورش في ملفين من ملفات حفص)
        if (c.part + 1 < items.get(c.pos).files.length) return new Cursor(c.pos, c.part + 1, c.verseRep, c.rangeRep);
        // تكرار الآية: من أولها من جديد، بلا بسملة
        int vr = c.verseRep + 1;
        if (vr < verseRepeat) return start(c.pos, vr, c.rangeRep, false);
        int pos = c.pos + 1;
        int rr = c.rangeRep;
        if (pos >= items.size()) {
            if (continuous) return null;
            pos = 0;
            if (rangeRepeat != FOREVER && ++rr >= rangeRepeat) return null;
        }
        return start(pos, 0, rr, true);
    }

    /** السابق (d = -1) أو التالي (d = 1) من الإشعار وشاشة القفل (skip). */
    public Cursor skip(Cursor c, int d) {
        int n = items.size();
        int pos = ((c.pos + d) % n + n) % n;
        return start(pos, 0, c.rangeRep, true);
    }

    /** هل انتهاء c نهاية قراءة الآية؟ (لا البسملة ولا ملف قبل آخر ملفاتها) — عندها يُفحص مؤقّت التلاوة. */
    public boolean endsVerse(Cursor c) {
        return !c.isBasmala() && c.part == items.get(c.pos).files.length - 1;
    }

    /** رابط ملف c. */
    public String file(Cursor c) {
        Item it = items.get(c.pos);
        return c.isBasmala() ? it.basmala : it.files[c.part];
    }
}
