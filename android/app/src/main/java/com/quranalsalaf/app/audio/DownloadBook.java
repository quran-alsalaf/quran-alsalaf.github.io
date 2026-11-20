package com.quranalsalaf.app.audio;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * سجلّ تحميل القرّاء لكامل القرآن داخل التطبيق (الجلسة ٢ ب، ٢٠٢٦-١١-٢٠): حالة كل قارئ، والجاري تحميله،
 * ومن ينتظر دوره. قارئ واحد يُحمَّل في كل مرة، وما يُطلب بعده ينتظر («بالانتظار») ويبدأ وحده بعد الجاري.
 *
 * الحالات: downloading (ومعه waiting إذا توقف لانقطاع الاتصال وينتظر رجوعه) · queued · paused · done.
 * يُحفظ (save) ويُستعاد (restore) عند فتح التطبيق من جديد: ما لم يكتمل يصير «متوقفًا» يُستأنف بزرّه.
 *
 * شكل الحالة للصفحة (toJson) كشكل src/lib/downloader.js، ومعه queue:
 *   { items: { [id]: { status, count, total, waiting? } }, active, queue: [id] }
 * لا يعتمد على أندرويد، فيُختبر وحده (DownloadBookTest).
 */
public final class DownloadBook {

    public static final String DOWNLOADING = "downloading";
    public static final String QUEUED = "queued";
    public static final String PAUSED = "paused";
    public static final String DONE = "done";

    /** نتائج enqueue. */
    public static final String STARTED = "started";

    static final class Item {
        String status;
        int count;
        int total;
        boolean waiting;

        Item(String status, int count, int total) {
            this.status = status;
            this.count = count;
            this.total = total;
        }
    }

    private final Map<String, Item> items = new LinkedHashMap<>();
    private final List<String> queue = new ArrayList<>();
    private final Map<String, List<String>> urls = new HashMap<>();
    private final Map<String, String> names = new HashMap<>();
    private String active;

    /**
     * يطلب تحميل القارئ id: يبدأ إن لم يكن غيره يُحمَّل («started»)، وإلا ينتظر دوره («queued»).
     * و«done» إن كان محمَّلًا.
     */
    public String enqueue(String id, String name, List<String> list) {
        Item it = items.get(id);
        if (it != null && DONE.equals(it.status)) return DONE;
        if (id.equals(active)) return STARTED;
        urls.put(id, new ArrayList<>(list));
        names.put(id, name);
        int count = it != null ? it.count : 0;
        if (active == null) {
            active = id;
            items.put(id, new Item(DOWNLOADING, count, list.size()));
            return STARTED;
        }
        if (!queue.contains(id)) queue.add(id);
        items.put(id, new Item(QUEUED, count, list.size()));
        return QUEUED;
    }

    /** الجاري تحميله، أو null. */
    public String active() {
        return active;
    }

    /** يبدأ التالي في الانتظار إن لم يكن شيء يُحمَّل، ويُرجعه (أو الجاري، أو null إن لم يبق شيء). */
    public String next() {
        if (active != null) return active;
        if (queue.isEmpty()) return null;
        active = queue.remove(0);
        Item it = items.get(active);
        if (it == null) items.put(active, it = new Item(DOWNLOADING, 0, urls.get(active).size()));
        it.status = DOWNLOADING;
        it.waiting = false;
        return active;
    }

    public List<String> urlsOf(String id) {
        List<String> l = urls.get(id);
        return l == null ? new ArrayList<>() : l;
    }

    public String nameOf(String id) {
        String n = names.get(id);
        return n == null ? "" : n;
    }

    public void progress(String id, int count, int total) {
        Item it = items.get(id);
        if (it == null || DONE.equals(it.status)) return;
        it.count = count;
        it.total = total;
    }

    public void setWaiting(String id, boolean waiting) {
        Item it = items.get(id);
        if (it != null) it.waiting = waiting;
    }

    /**
     * انتهى تحميل الجاري: «done» يجعله محمَّلًا، وغيره (أوقفه المستخدم، أو انقطع الاتصال، أو امتلأت المساحة…)
     * يجعله متوقفًا يُستأنف بزرّه (أو يزيله إن لم يُحمَّل منه شيء).
     */
    public void finish(String id, boolean done) {
        Item it = items.get(id);
        if (done) {
            int total = it != null ? it.total : urlsOf(id).size();
            items.put(id, new Item(DONE, total, total));
            urls.remove(id);
        } else if (it != null && !DONE.equals(it.status)) {
            stopItem(id, it);
        }
        if (id.equals(active)) active = null;
    }

    /**
     * إيقاف القارئ id بطلب المستخدم: المنتظر يخرج من الانتظار، والجاري يتوقف. يُرجع true إن كان هو الجاري
     * (فيقطع المحمِّل تحميله).
     */
    public boolean pause(String id) {
        Item it = items.get(id);
        if (queue.remove(id)) {
            if (it != null) stopItem(id, it);
            return false;
        }
        if (!id.equals(active)) return false;
        if (it != null) stopItem(id, it);
        active = null;
        return true;
    }

    /** يوقف الجاري ومن ينتظر كلهم (امتلأت المساحة، أو أُغلقت الخدمة). */
    public void pauseAll() {
        if (active != null) finish(active, false);
        for (String id : new ArrayList<>(queue)) pause(id);
    }

    private void stopItem(String id, Item it) {
        it.waiting = false;
        if (it.count > 0) it.status = PAUSED;
        else items.remove(id);
    }

    public boolean isDone(String id) {
        Item it = items.get(id);
        return it != null && DONE.equals(it.status);
    }

    public JSONObject toJson() {
        JSONObject out = new JSONObject();
        try {
            JSONObject m = new JSONObject();
            for (Map.Entry<String, Item> e : items.entrySet()) {
                Item it = e.getValue();
                JSONObject j = new JSONObject();
                j.put("status", it.status);
                j.put("count", it.count);
                j.put("total", it.total);
                if (it.waiting) j.put("waiting", true);
                m.put(e.getKey(), j);
            }
            out.put("items", m);
            out.put("active", active == null ? JSONObject.NULL : active);
            out.put("queue", new JSONArray(queue));
        } catch (JSONException ignored) {
        }
        return out;
    }

    /** ما يُحفظ على الجهاز: حالة كل قارئ (الجاري والمنتظر يُحفظان متوقفَين). */
    public String save() {
        JSONObject m = new JSONObject();
        try {
            for (Map.Entry<String, Item> e : items.entrySet()) {
                Item it = e.getValue();
                if (!DONE.equals(it.status) && it.count == 0) continue;
                JSONObject j = new JSONObject();
                j.put("status", DONE.equals(it.status) ? DONE : PAUSED);
                j.put("count", it.count);
                j.put("total", it.total);
                m.put(e.getKey(), j);
            }
        } catch (JSONException ignored) {
        }
        return m.toString();
    }

    public static DownloadBook restore(String saved) {
        DownloadBook b = new DownloadBook();
        if (saved == null || saved.isEmpty()) return b;
        try {
            JSONObject m = new JSONObject(saved);
            for (java.util.Iterator<String> k = m.keys(); k.hasNext(); ) {
                String id = k.next();
                JSONObject j = m.getJSONObject(id);
                String status = DONE.equals(j.optString("status")) ? DONE : PAUSED;
                b.items.put(id, new Item(status, j.optInt("count"), j.optInt("total")));
            }
        } catch (JSONException ignored) {
        }
        return b;
    }
}
