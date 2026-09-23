# One Alchemy — SSP (Sales & Promotion Platform)

เว็บ HTML + CSS + JavaScript ธรรมดา ใช้ Supabase เป็นฐานข้อมูล / Login และ deploy บน Vercel

## โครงสร้างโฟลเดอร์

```
MASTER/
├── index.html          ← หน้า Login (หน้าแรก)
├── dashboard.html      ← ภาพรวม
├── outlets.html        ← Outlet Master (ร้านค้า)
├── data_u.html         ← Data Universe (ตารางข้อมูลหลัก)
├── contracts.html      ← Contract Master (สัญญา)
├── promotions.html     ← Promotions
├── sku.html            ← SKU (สินค้า)
├── roi.html            ← ROI Analysis
├── offtake.html        ← Off-take 2026
├── users.html          ← User Management (ผู้ใช้)
│
├── css/
│   └── ssp-theme.css   ← ธีม / สีของทั้งเว็บ (แก้ที่นี่ที่เดียว)
├── js/
│   ├── config.js       ← ค่าเชื่อมต่อ Supabase
│   ├── nav-icons.js    ← ไอคอนเมนู
│   └── thai_geo.js     ← ข้อมูลจังหวัด / อำเภอ
│
├── tools/              ← หน้าเครื่องมือสำหรับ Admin (ไม่ใช่หน้าใช้งานปกติ)
│   ├── diagnostic.html     ← ตรวจการเชื่อมต่อ Supabase / Login
│   └── setup_account.html  ← สร้างบัญชี Login ครั้งแรก
│
├── database/           ← ไฟล์ SQL (รันใน Supabase → SQL Editor)
│   ├── 1-setup/            ← สร้างตาราง / สิทธิ์ (ใช้ตอนตั้งระบบใหม่)
│   ├── 2-update-sync/      ← เพิ่มคอลัมน์ / ซิงก์ข้อมูลระหว่างตาราง
│   └── 3-fix-diagnose/     ← แก้ปัญหา Login / ตรวจสอบข้อมูล
│
└── vercel.json         ← ตั้งค่า Vercel (ปิด cache)
```

## ไฟล์ SQL แต่ละกลุ่ม

**1-setup** — สร้างระบบ
| ไฟล์ | ใช้ทำอะไร |
|---|---|
| setup_full.sql | ตั้งค่าทั้งหมด (รันครั้งเดียวหลังสร้างตารางใหม่) |
| setup.sql | ตั้งค่าเริ่มต้นแบบเดิม (Contract Hub) |
| run_all_setup.sql | ตั้งค่า user_profile ทีละ STEP |
| setup_users.sql | ตารางผู้ใช้ |
| setup_log_table.sql | ตาราง Log การแก้ไข |
| setup_data_u.sql / setup_data_u_complete.sql / data_u_schema.sql | ตาราง Data Universe |
| setup_data_u_stats.sql | ฟังก์ชันนับตัวเลข KPI (`data_u_stats`) |
| add_rls_existing_tables.sql | เปิดสิทธิ์อ่านข้อมูลของตารางที่มีอยู่แล้ว |

**2-update-sync** — อัปเดตข้อมูล
| ไฟล์ | ใช้ทำอะไร |
|---|---|
| add_bde_column.sql | เพิ่มคอลัมน์ BDE ใน Data U |
| add_admin_user.sql | เพิ่ม Admin user |
| sync_bde_team.sql | ซิงก์ BDE + TEAM จาก Outlet Master → Data U |
| sync_company_name.sql | ซิงก์ Company Name → Data U |
| sync_outlet_master.sql | ซิงก์ Company / Group Name / Group Code → Data U |
| protect_data_u.sql | เก็บ Company / BDE / TEAM ไว้ถาวรแม้ลบ Outlet |

**3-fix-diagnose** — แก้ปัญหา
| ไฟล์ | ใช้ทำอะไร |
|---|---|
| diagnose_login.sql | ตรวจสอบปัญหา Login |
| fix_admin_login.sql | แก้ Login ของ Admin |
| fix_username_login.sql | ให้ใช้ username เป็นชื่อ Login |

## ลิงก์
- GitHub: https://github.com/alchemyssp/One-Alchemy (branch `main`)
