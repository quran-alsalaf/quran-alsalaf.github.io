package com.quranalsalaf.app.audio;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/** التحميل إلى الجهاز (BulkDownload) بخادم محلي: الناقص وحده، والإيقاف، وأخطاء الخادم، وانقطاع الاتصال. */
public class BulkDownloadTest {

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    // خادم محلي صغير (ServerSocket): واجهة com.sun.net.httpserver غير متاحة في اختبارات أندرويد
    private ServerSocket server;
    private String base;
    private final AtomicInteger hits = new AtomicInteger();
    private final Set<String> broken = ConcurrentHashMap.newKeySet();
    private volatile long delayMs;

    @Before
    public void up() throws IOException {
        server = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
        base = "http://127.0.0.1:" + server.getLocalPort();
        Thread accept = new Thread(() -> {
            while (!server.isClosed()) {
                try {
                    Socket sock = server.accept();
                    new Thread(() -> serve(sock)).start();
                } catch (IOException e) {
                    return;
                }
            }
        });
        accept.setDaemon(true);
        accept.start();
    }

    private void serve(Socket sock) {
        try (Socket s = sock) {
            BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));
            String line = in.readLine();
            if (line == null) return;
            String path = line.split(" ")[1];
            while ((line = in.readLine()) != null && !line.isEmpty()) {
                // العناوين لا تُستعمل
            }
            hits.incrementAndGet();
            if (delayMs > 0) Thread.sleep(delayMs);
            OutputStream out = s.getOutputStream();
            if (broken.contains(path)) {
                out.write("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".getBytes(StandardCharsets.UTF_8));
            } else {
                byte[] body = ("audio:" + path).getBytes(StandardCharsets.UTF_8);
                out.write(("HTTP/1.1 200 OK\r\nContent-Type: audio/mpeg\r\nContent-Length: " + body.length + "\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.UTF_8));
                out.write(body);
            }
            out.flush();
        } catch (IOException | InterruptedException | RuntimeException ignored) {
        }
    }

    @After
    public void down() throws IOException {
        server.close();
    }

    private static BulkDownload.Options fast() {
        BulkDownload.Options o = new BulkDownload.Options();
        o.retryDelayMs = 10;
        o.minFreeBytes = 0;
        o.connectTimeoutMs = 2000;
        o.readTimeoutMs = 2000;
        return o;
    }

    private List<String> urls(int n) {
        List<String> l = new ArrayList<>();
        for (int i = 1; i <= n; i++) l.add(base + "/r/" + String.format("%03d", i) + ".mp3");
        return l;
    }

    @Test
    public void يحمل_الكل_ثم_لا_يعيد_المحفوظ() throws IOException {
        File root = tmp.newFolder("audio");
        List<String> list = urls(20);
        List<Integer> seen = Collections.synchronizedList(new ArrayList<>());
        assertEquals(BulkDownload.Result.DONE, new BulkDownload(fast()).run(root, list, (s, t) -> {
            assertEquals(20, t);
            seen.add(s);
        }));
        assertEquals(20, hits.get());
        assertEquals(Integer.valueOf(20), Collections.max(seen));
        File f = AudioFiles.saved(root, list.get(4));
        assertEquals("audio:/r/005.mp3", new String(Files.readAllBytes(f.toPath())));
        assertTrue(AudioFiles.missing(root, list).isEmpty());
        // لا ملفات مؤقتة باقية
        assertFalse(new File(f.getPath() + AudioFiles.PART).exists());
        // مرة ثانية: لا يُطلب شيء، والتقدّم كامل من أوله
        List<Integer> again = new ArrayList<>();
        assertEquals(BulkDownload.Result.DONE, new BulkDownload(fast()).run(root, list, (s, t) -> again.add(s)));
        assertEquals(20, hits.get());
        assertEquals(Collections.singletonList(20), again);
    }

    @Test
    public void خطأ_الخادم_يوقفه_وما_حمل_يبقى() throws IOException {
        File root = tmp.newFolder("audio");
        List<String> list = urls(10);
        broken.add("/r/006.mp3");
        BulkDownload.Options o = fast();
        o.concurrency = 1;
        assertEquals(BulkDownload.Result.FAILED, new BulkDownload(o).run(root, list, null));
        // محاولتان أُخريان للملف قبل التوقف
        assertEquals(5 + 3, hits.get());
        assertEquals(5, list.size() - AudioFiles.missing(root, list).size());
        broken.clear();
        assertEquals(BulkDownload.Result.DONE, new BulkDownload(o).run(root, list, null));
        assertEquals(8 + 5, hits.get()); // يكمل الناقص وحده
    }

    @Test
    public void انقطاع_الاتصال() throws IOException {
        File root = tmp.newFolder("audio");
        List<String> list = urls(3);
        server.close();
        assertEquals(BulkDownload.Result.NETWORK, new BulkDownload(fast()).run(root, list, null));
        assertEquals(3, AudioFiles.missing(root, list).size());
    }

    @Test
    public void الإيقاف_يقطع_التحميل() throws Exception {
        File root = tmp.newFolder("audio");
        List<String> list = urls(200);
        delayMs = 20;
        BulkDownload b = new BulkDownload(fast());
        AtomicInteger at = new AtomicInteger();
        Thread t = new Thread(() -> {
            BulkDownload.Result r = b.run(root, list, (s, total) -> {
                if (s >= 10) b.cancel();
            });
            at.set(r.ordinal());
        });
        t.start();
        t.join(10000);
        assertFalse(t.isAlive());
        assertEquals(BulkDownload.Result.CANCELLED.ordinal(), at.get());
        int left = AudioFiles.missing(root, list).size();
        assertTrue(left > 100);
        // لا ملف ناقص يُعدّ محفوظًا: كل محفوظ كامل
        for (String u : list) {
            File f = AudioFiles.saved(root, u);
            if (f != null) assertEquals("audio:" + u.substring(base.length()), new String(Files.readAllBytes(f.toPath())));
        }
    }

    @Test
    public void ضيق_المساحة() throws IOException {
        File root = tmp.newFolder("audio");
        BulkDownload.Options o = fast();
        o.minFreeBytes = Long.MAX_VALUE;
        assertEquals(BulkDownload.Result.NOSPACE, new BulkDownload(o).run(root, urls(3), null));
        assertEquals(0, hits.get());
    }
}
