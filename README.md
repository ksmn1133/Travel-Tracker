<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/826962e3-35f7-4a22-b23e-20e6f32ef654

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

#Self Intro
大家好我是Shawn Xiao, 前四大个税组员工。因为工作涉及到global mobility的个税，所以开发了这款个税相关的app。希望各位前辈多给提提意见。
目前在看新的职业发展机会，希望大佬可以捞一下我。💗

#业务逻辑 Pending
1. 主要针对无住所个人在中国的个人所得税问题：居民身份的判定（6年提醒），月度个人所得税计算（详细计算公式展示），月度申报数据生成（完成了非居民工资薪金），年度居民转非居民计算及申报补税，年度居民汇算清缴。
2. 个人信息的收集。纳税人姓名，国籍，护照号，出生日期，身份证号，性别。（通过护照照片上传OCR识别完成后手动修改）
3. 工资相关数据的收集。
