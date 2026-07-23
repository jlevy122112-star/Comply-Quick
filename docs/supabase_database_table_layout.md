## Table `subscriptions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `tier` | `text` |  |
| `status` | `text` |  |
| `stripe_customer_id` | `text` |  Nullable |
| `stripe_subscription_id` | `text` |  Nullable |
| `current_period_end` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  |

## Table `projects`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `name` | `text` |  |
| `framework` | `text` |  |
| `tracking_pixels` | `_text` |  |
| `target_regions` | `_text` |  |
| `compliance_modules` | `_text` |  |
| `compliance_score` | `jsonb` |  |
| `status` | `text` |  |
| `package_markdown` | `text` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `client_id` | `uuid` |  Nullable |
| `organization_id` | `uuid` |  Nullable |
| `workspace_id` | `uuid` |  Nullable |

## Table `regulations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `region` | `text` |  |
| `summary` | `text` |  |
| `source_url` | `text` |  Nullable |
| `current_version` | `int4` |  |
| `content_hash` | `text` |  Nullable |
| `last_checked_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  |

## Table `regulation_versions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `regulation_id` | `text` |  |
| `version` | `int4` |  |
| `summary` | `text` |  |
| `content_hash` | `text` |  Nullable |
| `change_note` | `text` |  |
| `created_at` | `timestamptz` |  |

## Table `document_versions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `project_id` | `uuid` |  |
| `user_id` | `uuid` |  |
| `status` | `text` |  |
| `triggered_by` | `text` |  |
| `regulation_id` | `text` |  Nullable |
| `summary` | `text` |  |
| `diff` | `jsonb` |  |
| `package_markdown` | `text` |  |
| `compliance_score` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  |
| `resolved_at` | `timestamptz` |  Nullable |

## Table `notifications`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `type` | `text` |  |
| `title` | `text` |  |
| `body` | `text` |  |
| `related_project_id` | `uuid` |  Nullable |
| `related_version_id` | `uuid` |  Nullable |
| `read` | `bool` |  |
| `created_at` | `timestamptz` |  |

## Table `scans`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `url` | `text` |  |
| `status` | `text` |  |
| `score` | `int4` |  Nullable |
| `detected_tools` | `jsonb` |  |
| `findings` | `jsonb` |  |
| `summary` | `text` |  |
| `error` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `monitor_id` | `uuid` |  Nullable |
| `project_id` | `uuid` |  Nullable |

## Table `scan_monitors`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `url` | `text` |  |
| `label` | `text` |  |
| `frequency` | `text` |  |
| `active` | `bool` |  |
| `last_scanned_at` | `timestamptz` |  Nullable |
| `last_scan_id` | `uuid` |  Nullable |
| `last_score` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `client_id` | `uuid` |  Nullable |

## Table `compliance_alerts`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `monitor_id` | `uuid` |  Nullable |
| `scan_id` | `uuid` |  Nullable |
| `type` | `text` |  |
| `severity` | `text` |  |
| `title` | `text` |  |
| `body` | `text` |  |
| `detail` | `jsonb` |  |
| `fix_recommendation` | `text` |  Nullable |
| `read` | `bool` |  |
| `resolved` | `bool` |  |
| `created_at` | `timestamptz` |  |

## Table `agencies`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `owner_id` | `uuid` |  Unique |
| `name` | `text` |  |
| `slug` | `text` |  Unique |
| `logo_url` | `text` |  Nullable |
| `primary_color` | `text` |  |
| `support_email` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `agency_members`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `agency_id` | `uuid` |  |
| `user_id` | `uuid` |  |
| `role` | `text` |  |
| `created_at` | `timestamptz` |  |

## Table `agency_clients`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `agency_id` | `uuid` |  |
| `name` | `text` |  |
| `contact_email` | `text` |  Nullable |
| `website_url` | `text` |  Nullable |
| `notes` | `text` |  |
| `status` | `text` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `agency_domains`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `agency_id` | `uuid` |  |
| `domain` | `text` |  Unique |
| `status` | `text` |  |
| `verification_token` | `text` |  |
| `cf_hostname_id` | `text` |  Nullable |
| `verified_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `provider` | `text` |  Nullable |
| `dns` | `jsonb` |  |

## Table `marketplace_creators`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Unique |
| `display_name` | `text` |  |
| `slug` | `text` |  Unique |
| `bio` | `text` |  |
| `stripe_account_id` | `text` |  Nullable |
| `payouts_enabled` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `marketplace_templates`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `creator_id` | `uuid` |  |
| `title` | `text` |  |
| `slug` | `text` |  Unique |
| `summary` | `text` |  |
| `description` | `text` |  |
| `category` | `text` |  |
| `price_cents` | `int4` |  |
| `currency` | `text` |  |
| `content` | `jsonb` |  |
| `preview` | `text` |  |
| `status` | `text` |  |
| `sales_count` | `int4` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `type` | `text` |  |
| `body` | `text` |  |

## Table `marketplace_purchases`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `template_id` | `uuid` |  |
| `buyer_id` | `uuid` |  |
| `amount_cents` | `int4` |  |
| `platform_fee_cents` | `int4` |  |
| `currency` | `text` |  |
| `stripe_session_id` | `text` |  Nullable |
| `status` | `text` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `billing_overages`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `period` | `text` |  |
| `scans_used` | `int4` |  |
| `scans_over` | `int4` |  |
| `overage_cents` | `int4` |  |
| `reported_to_stripe_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `api_keys`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `name` | `text` |  |
| `key_prefix` | `text` |  |
| `key_hash` | `text` |  Unique |
| `last_used_at` | `timestamptz` |  Nullable |
| `revoked_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `api_usage_events`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `api_key_id` | `uuid` |  Nullable |
| `period` | `text` |  |
| `endpoint` | `text` |  |
| `meter` | `text` |  |
| `quantity` | `int4` |  |
| `cost_cents` | `int4` |  |
| `created_at` | `timestamptz` |  |

## Table `api_usage_meters`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `period` | `text` |  |
| `meter` | `text` |  |
| `quantity` | `int4` |  |
| `cost_cents` | `int4` |  |
| `reported_to_stripe_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `published_scores`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `scan_id` | `uuid` |  |
| `slug` | `text` |  Unique |
| `url` | `text` |  |
| `label` | `text` |  Nullable |
| `score` | `int4` |  |
| `revoked_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `partners`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Unique |
| `referral_code` | `text` |  Unique |
| `stripe_account_id` | `text` |  Nullable |
| `payouts_enabled` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `partner_referrals`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `partner_id` | `uuid` |  |
| `referred_user_id` | `uuid` |  Unique |
| `created_at` | `timestamptz` |  |

## Table `partner_commissions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `partner_id` | `uuid` |  |
| `referred_user_id` | `uuid` |  Nullable |
| `stripe_invoice_id` | `text` |  Unique |
| `gross_cents` | `int4` |  |
| `commission_cents` | `int4` |  |
| `currency` | `text` |  |
| `status` | `text` |  |
| `created_at` | `timestamptz` |  |

## Table `compliance_tasks`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `agency_client_id` | `uuid` |  Nullable |
| `title` | `text` |  |
| `description` | `text` |  |
| `category` | `text` |  |
| `severity` | `text` |  |
| `due_date` | `date` |  |
| `status` | `text` |  |
| `source` | `text` |  |
| `related_scan_id` | `uuid` |  Nullable |
| `related_alert_id` | `uuid` |  Nullable |
| `metadata` | `jsonb` |  |
| `completed_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `project_id` | `uuid` |  Nullable |

## Table `calendar_feeds`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `token` | `text` |  Unique |
| `revoked_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `legal_review_items`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `title` | `text` |  |
| `category` | `text` |  |
| `content_ref` | `text` |  |
| `status` | `text` |  |
| `reviewer` | `text` |  Nullable |
| `notes` | `text` |  |
| `reviewed_at` | `timestamptz` |  Nullable |
| `next_review_at` | `date` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `nps_responses`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `score` | `int2` |  |
| `comment` | `text` |  |
| `channel` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `churn_surveys`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `reason` | `text` |  |
| `comment` | `text` |  |
| `channel` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `tool_usage_events`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `tool` | `text` |  |
| `created_at` | `timestamptz` |  |

## Table `push_tokens`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `token` | `text` |  |
| `platform` | `text` |  |
| `created_at` | `timestamptz` |  |
| `last_used_at` | `timestamptz` |  Nullable |

## Table `notification_preferences`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `email_enabled` | `bool` |  |
| `push_enabled` | `bool` |  |
| `muted_categories` | `_text` |  |
| `updated_at` | `timestamptz` |  |

## Table `findings`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `scan_id` | `uuid` |  |
| `project_id` | `uuid` |  Nullable |
| `finding_key` | `text` |  |
| `category` | `text` |  |
| `severity` | `text` |  |
| `title` | `text` |  |
| `detail` | `text` |  |
| `recommendation` | `text` |  |
| `status` | `text` |  |
| `owner` | `text` |  Nullable |
| `due_date` | `date` |  Nullable |
| `first_detected_at` | `timestamptz` |  |
| `last_detected_at` | `timestamptz` |  |
| `resolved_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `finding_events`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `finding_id` | `uuid` |  |
| `type` | `text` |  |
| `from_status` | `text` |  Nullable |
| `to_status` | `text` |  Nullable |
| `note` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `evidence_records`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `project_id` | `uuid` |  Nullable |
| `framework` | `text` |  |
| `control_id` | `text` |  |
| `control_title` | `text` |  |
| `risk_level` | `text` |  |
| `status` | `text` |  |
| `required_evidence` | `jsonb` |  |
| `evidence_ref` | `text` |  Nullable |
| `source_url` | `text` |  |
| `generated_at` | `timestamptz` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `audit_logs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `project_id` | `uuid` |  Nullable |
| `action` | `text` |  |
| `entity_type` | `text` |  |
| `entity_id` | `text` |  Nullable |
| `summary` | `text` |  |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |

## Table `project_members`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `project_id` | `uuid` |  |
| `user_id` | `uuid` |  |
| `role` | `text` |  |
| `created_at` | `timestamptz` |  |

## Table `alert_impacts`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `project_id` | `uuid` |  |
| `version_id` | `uuid` |  Nullable |
| `regulation_id` | `text` |  |
| `regulation_name` | `text` |  |
| `risk_level` | `text` |  |
| `score_penalty` | `int4` |  |
| `status` | `text` |  |
| `created_at` | `timestamptz` |  |
| `resolved_at` | `timestamptz` |  Nullable |

## Table `project_domains`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `project_id` | `uuid` |  |
| `domain` | `text` |  |
| `verified` | `bool` |  |
| `created_at` | `timestamptz` |  |

## Table `task_comments`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `task_id` | `uuid` |  |
| `project_id` | `uuid` |  Nullable |
| `author_id` | `uuid` |  |
| `body` | `text` |  |
| `created_at` | `timestamptz` |  |

## Table `integrations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `kind` | `text` |  |
| `name` | `text` |  |
| `target_url` | `text` |  |
| `active` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `organizations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `owner_id` | `uuid` |  |
| `name` | `text` |  |
| `slug` | `text` |  Unique |
| `plan` | `text` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `organization_members`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `organization_id` | `uuid` |  |
| `user_id` | `uuid` |  |
| `role` | `text` |  |
| `created_at` | `timestamptz` |  |

## Table `workspaces`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `organization_id` | `uuid` |  |
| `name` | `text` |  |
| `slug` | `text` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `workspace_members`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `workspace_id` | `uuid` |  |
| `user_id` | `uuid` |  |
| `role` | `text` |  |
| `created_at` | `timestamptz` |  |

## Table `sso_connections`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `organization_id` | `uuid` |  |
| `protocol` | `text` |  |
| `display_name` | `text` |  |
| `email_domain` | `text` |  Unique |
| `metadata_url` | `text` |  Nullable |
| `enabled` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `leads`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `email` | `text` |  Unique |
| `source` | `text` |  |
| `utm_source` | `text` |  Nullable |
| `utm_medium` | `text` |  Nullable |
| `utm_campaign` | `text` |  Nullable |
| `welcomed` | `bool` |  |
| `founding_member` | `bool` |  |
| `created_at` | `timestamptz` |  |

## Table `support_threads`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `customer_email` | `text` |  |
| `subject` | `text` |  Nullable |
| `lead_id` | `uuid` |  Nullable |
| `status` | `text` |  |
| `last_direction` | `text` |  |
| `last_message_at` | `timestamptz` |  |
| `created_at` | `timestamptz` |  |

## Table `support_messages`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `thread_id` | `uuid` |  |
| `direction` | `text` |  |
| `from_email` | `text` |  |
| `to_email` | `text` |  |
| `subject` | `text` |  Nullable |
| `body_text` | `text` |  Nullable |
| `body_html` | `text` |  Nullable |
| `provider_message_id` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `connector_connections`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `agency_org_id` | `uuid` |  |
| `client_seat_id` | `uuid` |  Nullable |
| `platform` | `text` |  |
| `external_account_id` | `text` |  |
| `status` | `text` |  |
| `mode` | `text` |  |
| `scopes` | `_text` |  |
| `access_token_enc` | `text` |  Nullable |
| `refresh_token_enc` | `text` |  Nullable |
| `token_expires_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `last_verified_at` | `timestamptz` |  Nullable |

## Table `connector_events`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `connection_id` | `uuid` |  |
| `type` | `text` |  |
| `payload_ref` | `text` |  Nullable |
| `received_at` | `timestamptz` |  |

## Table `connector_remediations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `connection_id` | `uuid` |  |
| `trigger_event_id` | `uuid` |  Nullable |
| `changes` | `jsonb` |  |
| `status` | `text` |  |
| `created_at` | `timestamptz` |  |
| `applied_at` | `timestamptz` |  Nullable |

## Table `connector_audit_ledger`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `connection_id` | `uuid` |  |
| `actor` | `text` |  |
| `action` | `text` |  |
| `previous_state_ref` | `text` |  Nullable |
| `ok` | `bool` |  |
| `at` | `timestamptz` |  |

## Table `data_subject_requests`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `type` | `text` |  |
| `status` | `text` |  |
| `requested_at` | `timestamptz` |  |
| `completed_at` | `timestamptz` |  Nullable |
| `detail` | `jsonb` |  Nullable |

## Table `consent_records`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `project_id` | `uuid` |  |
| `subject_ref` | `text` |  |
| `action` | `text` |  |
| `categories` | `_text` |  |
| `consent_model` | `text` |  |
| `policy_version` | `text` |  Nullable |
| `region` | `text` |  Nullable |
| `user_agent` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `deployment_id` | `uuid` |  Nullable |

## Table `breach_incidents`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `title` | `text` |  |
| `description` | `text` |  Nullable |
| `severity` | `text` |  |
| `status` | `text` |  |
| `discovered_at` | `timestamptz` |  |
| `occurred_at` | `timestamptz` |  Nullable |
| `contained_at` | `timestamptz` |  Nullable |
| `affected_individuals` | `int4` |  |
| `data_categories` | `_text` |  |
| `regions` | `_text` |  |
| `high_risk` | `bool` |  |
| `notifications` | `jsonb` |  |
| `notes` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `scim_tokens`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `organization_id` | `uuid` |  |
| `name` | `text` |  |
| `token_prefix` | `text` |  |
| `token_hash` | `text` |  Unique |
| `created_at` | `timestamptz` |  |
| `last_used_at` | `timestamptz` |  Nullable |
| `revoked_at` | `timestamptz` |  Nullable |

## Table `scim_users`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `organization_id` | `uuid` |  |
| `external_id` | `text` |  Nullable |
| `user_name` | `text` |  |
| `email` | `text` |  Nullable |
| `display_name` | `text` |  Nullable |
| `given_name` | `text` |  Nullable |
| `family_name` | `text` |  Nullable |
| `active` | `bool` |  |
| `raw` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `agency_onboarding_intake`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `agency_id` | `uuid` |  |
| `client_id` | `uuid` |  Unique |
| `status` | `text` |  |
| `answers` | `jsonb` |  |
| `submitted_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `consent_deployments`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `public_id` | `uuid` |  Unique |
| `project_id` | `uuid` |  |
| `site_url` | `text` |  |
| `site_origin` | `text` |  |
| `privacy_policy_url` | `text` |  |
| `policy_version` | `text` |  |
| `regions` | `_text` |  |
| `pixels` | `_text` |  |
| `enforcement_mode` | `text` |  |
| `status` | `text` |  |
| `last_verified_at` | `timestamptz` |  Nullable |
| `verification_detail` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `free_scan_claims`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `email` | `text` |  Unique |
| `source` | `text` |  |
| `token` | `uuid` |  Unique |
| `claimed_at` | `timestamptz` |  |
| `used_at` | `timestamptz` |  Nullable |

## RLS Policies

### `subscriptions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `subscriptions_select_own` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |

### `projects`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `projects_select_own` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `projects_insert_own` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_id)` |
| `projects_update_own` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |
| `projects_delete_own` | DELETE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `projects_select_member` | SELECT | public | PERMISSIVE | `is_project_member(id)` | — |
| `projects_select_org_member` | SELECT | public | PERMISSIVE | `(((organization_id IS NOT NULL) AND is_org_member(organization_id)) OR ((workspace_id IS NOT NULL) AND is_workspace_member(workspace_id)))` | — |

### `regulations`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `regulations_select_all` | SELECT | authenticated | PERMISSIVE | `true` | — |

### `regulation_versions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `regulation_versions_select_all` | SELECT | authenticated | PERMISSIVE | `true` | — |

### `document_versions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `document_versions_select_own` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `document_versions_update_own` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |

### `scan_monitors`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `scan_monitors_select_own` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `scan_monitors_insert_own` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_id)` |
| `scan_monitors_update_own` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |
| `scan_monitors_delete_own` | DELETE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |

### `compliance_alerts`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `compliance_alerts_select_own` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `compliance_alerts_update_own` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |

### `findings`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `findings_insert_own` | INSERT | authenticated | PERMISSIVE | — | `(auth.uid() = user_id)` |
| `findings_select_own` | SELECT | authenticated | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `findings_update_own` | UPDATE | authenticated | PERMISSIVE | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |
| `findings_delete_own` | DELETE | authenticated | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `findings_select_member` | SELECT | public | PERMISSIVE | `((project_id IS NOT NULL) AND is_project_member(project_id))` | — |

### `notifications`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `notifications_select_own` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `notifications_update_own` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |

### `scans`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `scans_select_own` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `scans_insert_own` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_id)` |
| `scans_delete_own` | DELETE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `scans_select_member` | SELECT | public | PERMISSIVE | `((project_id IS NOT NULL) AND is_project_member(project_id))` | — |

### `agencies`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `agencies_select_member` | SELECT | public | PERMISSIVE | `((owner_id = auth.uid()) OR is_agency_member(id))` | — |
| `agencies_insert_own` | INSERT | public | PERMISSIVE | — | `(owner_id = auth.uid())` |
| `agencies_update_own` | UPDATE | public | PERMISSIVE | `(owner_id = auth.uid())` | `(owner_id = auth.uid())` |
| `agencies_delete_own` | DELETE | public | PERMISSIVE | `(owner_id = auth.uid())` | — |

### `agency_members`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `agency_members_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR is_agency_member(agency_id))` | — |
| `agency_members_insert_owner` | INSERT | public | PERMISSIVE | — | `(EXISTS ( SELECT 1    FROM agencies a   WHERE ((a.id = agency_members.agency_id) AND (a.owner_id = auth.uid()))))` |
| `agency_members_delete_owner` | DELETE | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM agencies a   WHERE ((a.id = agency_members.agency_id) AND (a.owner_id = auth.uid()))))` | — |

### `agency_clients`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `agency_clients_all_member` | ALL | public | PERMISSIVE | `is_agency_member(agency_id)` | `is_agency_member(agency_id)` |

### `agency_domains`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `agency_domains_all_member` | ALL | public | PERMISSIVE | `is_agency_member(agency_id)` | `is_agency_member(agency_id)` |

### `billing_overages`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `billing_overages_all_own` | ALL | public | PERMISSIVE | `(user_id = auth.uid())` | `(user_id = auth.uid())` |

### `marketplace_creators`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `creators_select_all` | SELECT | public | PERMISSIVE | `true` | — |
| `creators_insert_own` | INSERT | public | PERMISSIVE | — | `(user_id = auth.uid())` |
| `creators_update_own` | UPDATE | public | PERMISSIVE | `(user_id = auth.uid())` | `(user_id = auth.uid())` |

### `marketplace_templates`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `templates_select_published_or_own` | SELECT | public | PERMISSIVE | `((status = 'published'::text) OR (EXISTS ( SELECT 1    FROM marketplace_creators c   WHERE ((c.id = marketplace_templates.creator_id) AND (c.user_id = auth.uid())))))` | — |
| `templates_insert_own` | INSERT | public | PERMISSIVE | — | `(EXISTS ( SELECT 1    FROM marketplace_creators c   WHERE ((c.id = marketplace_templates.creator_id) AND (c.user_id = auth.uid()))))` |
| `templates_update_own` | UPDATE | public | PERMISSIVE | `owns_template(id)` | `owns_template(id)` |
| `templates_delete_own` | DELETE | public | PERMISSIVE | `owns_template(id)` | — |

### `marketplace_purchases`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `purchases_select_buyer_or_seller` | SELECT | public | PERMISSIVE | `((buyer_id = auth.uid()) OR owns_template(template_id))` | — |

### `api_keys`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `api_keys_all_own` | ALL | public | PERMISSIVE | `(user_id = auth.uid())` | `(user_id = auth.uid())` |

### `api_usage_events`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `api_usage_events_select_own` | SELECT | public | PERMISSIVE | `(user_id = auth.uid())` | — |

### `api_usage_meters`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `api_usage_meters_select_own` | SELECT | public | PERMISSIVE | `(user_id = auth.uid())` | — |

### `published_scores`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `published_scores_all_own` | ALL | public | PERMISSIVE | `(user_id = auth.uid())` | `(user_id = auth.uid())` |
| `published_scores_public_read` | SELECT | anon, authenticated | PERMISSIVE | `(revoked_at IS NULL)` | — |

### `partners`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `partners_all_own` | ALL | public | PERMISSIVE | `(user_id = auth.uid())` | `(user_id = auth.uid())` |

### `partner_referrals`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `partner_referrals_read_own` | SELECT | public | PERMISSIVE | `(partner_id IN ( SELECT partners.id    FROM partners   WHERE (partners.user_id = auth.uid())))` | — |

### `partner_commissions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `partner_commissions_read_own` | SELECT | public | PERMISSIVE | `(partner_id IN ( SELECT partners.id    FROM partners   WHERE (partners.user_id = auth.uid())))` | — |

### `compliance_tasks`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `compliance_tasks_select_own` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `compliance_tasks_insert_own` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_id)` |
| `compliance_tasks_update_own` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |
| `compliance_tasks_delete_own` | DELETE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `compliance_tasks_select_member` | SELECT | public | PERMISSIVE | `((project_id IS NOT NULL) AND is_project_member(project_id))` | — |

### `calendar_feeds`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `calendar_feeds_all_own` | ALL | public | PERMISSIVE | `(user_id = auth.uid())` | `(user_id = auth.uid())` |

### `nps_responses`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `nps_insert_own` | INSERT | authenticated | PERMISSIVE | — | `(auth.uid() = user_id)` |

### `churn_surveys`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `churn_insert_own` | INSERT | authenticated | PERMISSIVE | — | `(auth.uid() = user_id)` |

### `tool_usage_events`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `tool_usage_insert_own` | INSERT | authenticated | PERMISSIVE | — | `(auth.uid() = user_id)` |
| `tool_usage_select_own` | SELECT | authenticated | PERMISSIVE | `(auth.uid() = user_id)` | — |

### `push_tokens`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `push_tokens_rw_own` | ALL | public | PERMISSIVE | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |

### `notification_preferences`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `notification_preferences_rw_own` | ALL | public | PERMISSIVE | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |

### `finding_events`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `finding_events_select_own` | SELECT | authenticated | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `finding_events_insert_own` | INSERT | authenticated | PERMISSIVE | — | `(auth.uid() = user_id)` |

### `evidence_records`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `evidence_records_select_own` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `evidence_records_insert_own` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_id)` |
| `evidence_records_update_own` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |
| `evidence_records_delete_own` | DELETE | public | PERMISSIVE | `(auth.uid() = user_id)` | — |

### `audit_logs`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `audit_logs_select_own` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `audit_logs_insert_own` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_id)` |

### `project_members`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `project_members_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR is_project_member(project_id))` | — |
| `project_members_insert_owner` | INSERT | public | PERMISSIVE | — | `(EXISTS ( SELECT 1    FROM projects p   WHERE ((p.id = project_members.project_id) AND (p.user_id = auth.uid()))))` |
| `project_members_delete_owner` | DELETE | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM projects p   WHERE ((p.id = project_members.project_id) AND (p.user_id = auth.uid()))))` | — |

### `alert_impacts`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `alert_impacts_select_own` | SELECT | public | PERMISSIVE | `(user_id = auth.uid())` | — |
| `alert_impacts_update_own` | UPDATE | public | PERMISSIVE | `(user_id = auth.uid())` | `(user_id = auth.uid())` |
| `alert_impacts_select_member` | SELECT | public | PERMISSIVE | `is_project_member(project_id)` | — |

### `project_domains`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `project_domains_select` | SELECT | public | PERMISSIVE | `is_project_member(project_id)` | — |
| `project_domains_insert_owner` | INSERT | public | PERMISSIVE | — | `(EXISTS ( SELECT 1    FROM projects p   WHERE ((p.id = project_domains.project_id) AND (p.user_id = auth.uid()))))` |
| `project_domains_delete_owner` | DELETE | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM projects p   WHERE ((p.id = project_domains.project_id) AND (p.user_id = auth.uid()))))` | — |

### `task_comments`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `task_comments_select` | SELECT | public | PERMISSIVE | `((author_id = auth.uid()) OR ((project_id IS NOT NULL) AND is_project_member(project_id)) OR (EXISTS ( SELECT 1    FROM compliance_tasks t   WHERE ((t.id = task_comments.task_id) AND (t.user_id = auth.uid())))))` | — |
| `task_comments_insert` | INSERT | public | PERMISSIVE | — | `((author_id = auth.uid()) AND (((project_id IS NOT NULL) AND is_project_member(project_id)) OR (EXISTS ( SELECT 1    FROM compliance_tasks t   WHERE ((t.id = task_comments.task_id) AND (t.user_id = auth.uid()))))))` |
| `task_comments_delete_author` | DELETE | public | PERMISSIVE | `(author_id = auth.uid())` | — |

### `connector_events`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `connector_events_insert` | INSERT | public | PERMISSIVE | — | `connector_caller_owns_connection(connection_id)` |
| `connector_events_select` | SELECT | public | PERMISSIVE | `connector_caller_owns_connection(connection_id)` | — |

### `connector_remediations`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `connector_remediations_select` | SELECT | public | PERMISSIVE | `connector_caller_owns_connection(connection_id)` | — |
| `connector_remediations_insert` | INSERT | public | PERMISSIVE | — | `connector_caller_owns_connection(connection_id)` |
| `connector_remediations_update` | UPDATE | public | PERMISSIVE | `connector_caller_owns_connection(connection_id)` | `connector_caller_owns_connection(connection_id)` |

### `integrations`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `integrations_select_own` | SELECT | public | PERMISSIVE | `(user_id = auth.uid())` | — |
| `integrations_insert_own` | INSERT | public | PERMISSIVE | — | `(user_id = auth.uid())` |
| `integrations_update_own` | UPDATE | public | PERMISSIVE | `(user_id = auth.uid())` | `(user_id = auth.uid())` |
| `integrations_delete_own` | DELETE | public | PERMISSIVE | `(user_id = auth.uid())` | — |

### `organizations`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `organizations_select_member` | SELECT | public | PERMISSIVE | `((owner_id = auth.uid()) OR is_org_member(id))` | — |
| `organizations_insert_own` | INSERT | public | PERMISSIVE | — | `(owner_id = auth.uid())` |
| `organizations_update_admin` | UPDATE | public | PERMISSIVE | `is_org_admin(id)` | `is_org_admin(id)` |
| `organizations_delete_owner` | DELETE | public | PERMISSIVE | `(owner_id = auth.uid())` | — |

### `organization_members`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `organization_members_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR is_org_member(organization_id))` | — |
| `organization_members_insert_admin` | INSERT | public | PERMISSIVE | — | `is_org_admin(organization_id)` |
| `organization_members_update_admin` | UPDATE | public | PERMISSIVE | `is_org_admin(organization_id)` | `is_org_admin(organization_id)` |
| `organization_members_delete_admin` | DELETE | public | PERMISSIVE | `is_org_admin(organization_id)` | — |

### `workspaces`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `workspaces_select_member` | SELECT | public | PERMISSIVE | `is_workspace_member(id)` | — |
| `workspaces_insert_manager` | INSERT | public | PERMISSIVE | — | `(org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))` |
| `workspaces_update_manager` | UPDATE | public | PERMISSIVE | `(org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))` | `(org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))` |
| `workspaces_delete_admin` | DELETE | public | PERMISSIVE | `is_org_admin(organization_id)` | — |

### `connector_connections`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `connector_connections_update` | UPDATE | public | PERMISSIVE | `is_org_admin(agency_org_id)` | `is_org_admin(agency_org_id)` |
| `connector_connections_delete` | DELETE | public | PERMISSIVE | `is_org_admin(agency_org_id)` | — |
| `connector_connections_select` | SELECT | public | PERMISSIVE | `is_org_member(agency_org_id)` | — |
| `connector_connections_insert` | INSERT | public | PERMISSIVE | — | `is_org_admin(agency_org_id)` |

### `workspace_members`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `workspace_members_select` | SELECT | public | PERMISSIVE | `((user_id = auth.uid()) OR is_workspace_member(workspace_id))` | — |
| `workspace_members_write_admin` | ALL | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM workspaces w   WHERE ((w.id = workspace_members.workspace_id) AND is_org_admin(w.organization_id))))` | `(EXISTS ( SELECT 1    FROM workspaces w   WHERE ((w.id = workspace_members.workspace_id) AND is_org_admin(w.organization_id))))` |

### `sso_connections`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `sso_connections_select_member` | SELECT | public | PERMISSIVE | `is_org_member(organization_id)` | — |
| `sso_connections_write_admin` | ALL | public | PERMISSIVE | `is_org_admin(organization_id)` | `is_org_admin(organization_id)` |

### `connector_audit_ledger`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `connector_audit_ledger_select` | SELECT | public | PERMISSIVE | `connector_caller_owns_connection(connection_id)` | — |
| `connector_audit_ledger_insert` | INSERT | public | PERMISSIVE | — | `connector_caller_owns_connection(connection_id)` |

### `data_subject_requests`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `dsr_select_own` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `dsr_insert_own` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_id)` |

### `consent_records`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `consent_select_owner` | SELECT | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM projects p   WHERE ((p.id = consent_records.project_id) AND (p.user_id = auth.uid()))))` | — |

### `breach_incidents`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `breach_select_own` | SELECT | public | PERMISSIVE | `(auth.uid() = user_id)` | — |
| `breach_insert_own` | INSERT | public | PERMISSIVE | — | `(auth.uid() = user_id)` |
| `breach_update_own` | UPDATE | public | PERMISSIVE | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |

### `scim_tokens`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `scim_tokens_select_member` | SELECT | public | PERMISSIVE | `is_org_member(organization_id)` | — |
| `scim_tokens_write_admin` | ALL | public | PERMISSIVE | `is_org_admin(organization_id)` | `is_org_admin(organization_id)` |

### `scim_users`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `scim_users_select_member` | SELECT | public | PERMISSIVE | `is_org_member(organization_id)` | — |

### `agency_onboarding_intake`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `agency_onboarding_intake_all_member` | ALL | public | PERMISSIVE | `is_agency_member(agency_id)` | `is_agency_member(agency_id)` |

### `consent_deployments`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `consent_deployments_select_owner` | SELECT | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM projects p   WHERE ((p.id = consent_deployments.project_id) AND (p.user_id = auth.uid()))))` | — |
| `consent_deployments_insert_owner` | INSERT | public | PERMISSIVE | — | `(EXISTS ( SELECT 1    FROM projects p   WHERE ((p.id = consent_deployments.project_id) AND (p.user_id = auth.uid()))))` |
| `consent_deployments_update_owner` | UPDATE | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM projects p   WHERE ((p.id = consent_deployments.project_id) AND (p.user_id = auth.uid()))))` | `(EXISTS ( SELECT 1    FROM projects p   WHERE ((p.id = consent_deployments.project_id) AND (p.user_id = auth.uid()))))` |

