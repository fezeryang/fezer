import { test, expect } from '@playwright/test';

// 测试前端 API 连接
test('API 连接测试', async ({ page }) => {
  // 访问前端页面
  await page.goto('https://fezeryang.github.io/fezer/');

  // 等待页面加载
  await page.waitForTimeout(3000);

  // 监听网络请求
  const apiRequests: any[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/chat')) {
      apiRequests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
      });
    }
  });

  page.on('response', response => {
    if (response.url().includes('/api/chat')) {
      response.json().then(data => {
        console.log('API 响应:', JSON.stringify(data).substring(0, 200));
      }).catch(() => {});
    }
  });

  // 截图查看页面状态
  await page.screenshot({ path: 'screenshot.png' });

  // 检查控制台错误
  const logs: any[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      logs.push(msg.text());
    }
  });

  await page.waitForTimeout(5000);

  console.log('API 请求数量:', apiRequests.length);
  console.log('控制台错误:', logs);

  // 验证 API 请求是否发出
  expect(apiRequests.length).toBeGreaterThan(0);
});
