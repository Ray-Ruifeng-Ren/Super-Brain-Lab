package org.superbrainlab.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 2026-11-02 安卓 Pad 版:用户「信息密度要和网页版类似」——
        // 安卓 WebView 默认按系统「字体大小」放大文字(很多平板默认 115%–130%),排版就比网页松、一屏装不下;固定 100% 与网页一致。
        WebSettings s = getBridge().getWebView().getSettings();
        s.setTextZoom(100);
        s.setSupportZoom(false);
    }
}
