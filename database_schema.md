# Database Schema

Project: WatchMe Business
Date: 2026-01-15

## Table: users

Columns found: 14

  - **user_id**: str
    Example: 9940b0e0-0841-4d9c-8ae4-1907ad1a5ef3
  - **name**: str
    Example: ゲストユーザー
  - **email**: str
    Example: anonymous
  - **created_at**: str
    Example: 2025-11-26T15:06:38
  - **newsletter_subscription**: bool
    Example: False
  - **updated_at**: str
    Example: 2025-11-26T15:06:38.055447+00:00
  - **status**: str
    Example: guest
  - **subscription_plan**: NoneType
  - **avatar_url**: NoneType
  - **apns_token**: str
    Example: 7c8166566d137f1f5c994852842fe6f2a777602f326a93a80b...
  - **auth_provider**: str
    Example: anonymous
  - **apns_environment**: str
    Example: production
  - **role**: str
    Example: parent
  - **facility_id**: NoneType

---

## Table: facilities

Columns found: 8

  - **id**: str
    Example: 00000000-0000-0000-0000-000000000001
  - **name**: str
    Example: テスト療育施設
  - **type**: str
    Example: therapy_center
  - **address**: NoneType
  - **phone**: NoneType
  - **email**: NoneType
  - **created_at**: str
    Example: 2026-01-14T04:09:01.74777+00:00
  - **updated_at**: str
    Example: 2026-01-14T04:09:01.74777+00:00

---

## Table: subjects

Columns found: 12

  - **subject_id**: str
    Example: ad378a6c-d72a-420d-80d8-5a6717e69170
  - **name**: str
    Example: 松本かや
  - **age**: int
    Example: 44
  - **gender**: str
    Example: 男性
  - **avatar_url**: str
    Example: https://watchme-avatars.s3.ap-southeast-2.amazonaw...
  - **notes**: str
    Example: WatchMe開発者。
音声✖️AIで認知傾向やメンタルヘルスを可視化するアプリを開発中。
日中は不...
  - **created_by_user_id**: str
    Example: 164cba5a-dba6-4cbc-9b39-4eea28d98fa5
  - **created_at**: str
    Example: 2025-11-17T13:12:22.398983+00:00
  - **updated_at**: str
    Example: 2025-12-04T00:24:12+00:00
  - **prefecture**: str
    Example: 神奈川県
  - **city**: str
    Example: 横浜市神奈川区大口仲町
  - **cognitive_type**: NoneType

---

## Table: business_children

Columns found: 4

  - **id**: str
    Example: 00000000-0000-0000-0000-000000000002
  - **facility_id**: str
    Example: 00000000-0000-0000-0000-000000000001
  - **name**: str
    Example: Test Child
  - **created_at**: str
    Example: 2026-01-15T02:50:57.491586+00:00

---

