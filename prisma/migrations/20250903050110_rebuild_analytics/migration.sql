-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "city" TEXT,
    "congressional_district" TEXT,
    "phone" TEXT,
    "state" TEXT,
    "street" TEXT,
    "zip" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_method" TEXT,
    "verification_data" JSONB,
    "verified_at" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "delivery_method" TEXT NOT NULL,
    "subject" TEXT,
    "preview" TEXT NOT NULL,
    "message_body" TEXT NOT NULL,
    "delivery_config" JSONB NOT NULL,
    "cwc_config" JSONB,
    "recipient_config" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "campaign_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT,
    "applicable_countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "jurisdiction_level" TEXT,
    "specific_locations" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "congressional_office" (
    "id" TEXT NOT NULL,
    "office_code" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "member_name" TEXT NOT NULL,
    "party" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "congressional_office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_campaign" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "delivery_type" TEXT NOT NULL,
    "recipient_id" TEXT,
    "cwc_delivery_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "representative" (
    "id" TEXT NOT NULL,
    "bioguide_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "chamber" TEXT NOT NULL,
    "office_code" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "representative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_representatives" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "representative_id" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_validated" TIMESTAMP(3),

    CONSTRAINT "user_representatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_personalization" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "variable_name" TEXT NOT NULL,
    "custom_value" TEXT NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 1,
    "last_used" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_personalization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_suggestions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "variable_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "suggestion_text" TEXT NOT NULL,
    "context_tags" JSONB,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "effectiveness_score" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_writing_style" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tone_preference" TEXT,
    "length_preference" TEXT,
    "personal_themes" JSONB,
    "writing_samples" JSONB,
    "engagement_metrics" JSONB,
    "last_analyzed" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_writing_style_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_analytics" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "variable_name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "total_uses" INTEGER NOT NULL DEFAULT 0,
    "personalization_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_length" DOUBLE PRECISION,
    "engagement_score" DOUBLE PRECISION,
    "top_themes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activation" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "source_user_id" TEXT,
    "activation_generation" INTEGER NOT NULL DEFAULT 0,
    "activation_method" TEXT NOT NULL,
    "geographic_distance" DOUBLE PRECISION,
    "activation_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "time_to_activation" DOUBLE PRECISION,
    "cascade_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_coordinates" (
    "user_id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "political_embedding" JSONB,
    "community_sheaves" JSONB,
    "embedding_version" TEXT NOT NULL DEFAULT 'v1',
    "last_calculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_coordinates_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "template_morphism" (
    "id" TEXT NOT NULL,
    "source_template_id" TEXT NOT NULL,
    "target_template_id" TEXT NOT NULL,
    "transformation_type" TEXT NOT NULL,
    "morphism_data" JSONB NOT NULL,
    "similarity_score" DOUBLE PRECISION,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "effectiveness_score" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_morphism_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "political_field_state" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "field_data" JSONB NOT NULL,
    "critical_points" JSONB,
    "community_topology" JSONB,
    "field_version" TEXT NOT NULL DEFAULT 'v1',
    "calculation_params" JSONB,

    CONSTRAINT "political_field_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_political_bubble" (
    "id" TEXT NOT NULL,
    "center_user_id" TEXT NOT NULL,
    "radius_miles" DOUBLE PRECISION NOT NULL,
    "shared_beliefs" JSONB NOT NULL,
    "bubble_strength" DOUBLE PRECISION NOT NULL,
    "edge_conflicts" JSONB,
    "member_count" INTEGER NOT NULL DEFAULT 1,
    "formation_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "local_political_bubble_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_intersection" (
    "id" TEXT NOT NULL,
    "community_a" TEXT NOT NULL,
    "community_b" TEXT NOT NULL,
    "shared_users" JSONB NOT NULL,
    "shared_issues" JSONB NOT NULL,
    "conflict_issues" JSONB,
    "influence_flow" JSONB,
    "intersection_strength" DOUBLE PRECISION NOT NULL,
    "discovered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_calculated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_intersection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "political_dead_end" (
    "id" TEXT NOT NULL,
    "political_view" JSONB NOT NULL,
    "origin_user_id" TEXT NOT NULL,
    "origin_location" JSONB NOT NULL,
    "blocking_factors" JSONB NOT NULL,
    "max_reach_miles" DOUBLE PRECISION NOT NULL,
    "decay_rate" DOUBLE PRECISION NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "identified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "political_dead_end_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_lifecycle" (
    "id" TEXT NOT NULL,
    "community_name" TEXT NOT NULL,
    "community_type" TEXT NOT NULL,
    "formation_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "peak_date" TIMESTAMP(3),
    "dissolution_date" TIMESTAMP(3),
    "trigger_event" TEXT,
    "founding_template_id" TEXT,
    "member_count_timeline" JSONB NOT NULL,
    "engagement_timeline" JSONB NOT NULL,
    "current_status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "community_lifecycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_context_stack" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "geographic_context" JSONB NOT NULL,
    "economic_context" JSONB NOT NULL,
    "social_context" JSONB NOT NULL,
    "institutional_context" JSONB NOT NULL,
    "context_conflicts" JSONB,
    "dominant_context" TEXT,
    "context_stability" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "last_calculated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_context_stack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "political_flow" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "time_window_hours" INTEGER NOT NULL DEFAULT 24,
    "flow_sources" JSONB NOT NULL,
    "flow_sinks" JSONB NOT NULL,
    "flow_velocity" JSONB NOT NULL,
    "flow_direction" JSONB NOT NULL,
    "turbulence_zones" JSONB,
    "flow_strength" DOUBLE PRECISION NOT NULL,
    "dominant_issues" JSONB NOT NULL,

    CONSTRAINT "political_flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "political_uncertainty" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "template_id" TEXT,
    "position_cloud" JSONB NOT NULL,
    "certainty_level" DOUBLE PRECISION NOT NULL,
    "change_likelihood" DOUBLE PRECISION NOT NULL,
    "influence_susceptibility" JSONB NOT NULL,
    "position_volatility" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "last_position_change" TIMESTAMP(3),
    "uncertainty_calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "political_uncertainty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legislative_channel" (
    "id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "country_name" TEXT NOT NULL,
    "legislature_name" TEXT NOT NULL,
    "legislature_type" TEXT NOT NULL,
    "access_method" TEXT NOT NULL,
    "access_tier" INTEGER NOT NULL DEFAULT 3,
    "email_pattern" TEXT,
    "email_domain" TEXT,
    "email_format_notes" TEXT,
    "api_endpoint" TEXT,
    "api_auth_type" TEXT,
    "api_documentation_url" TEXT,
    "rate_limit_requests" INTEGER,
    "rate_limit_daily" INTEGER,
    "form_url" TEXT,
    "form_requires_captcha" BOOLEAN NOT NULL DEFAULT false,
    "form_max_length" INTEGER,
    "primary_language" TEXT NOT NULL,
    "supported_languages" TEXT[],
    "requires_constituent" BOOLEAN NOT NULL DEFAULT false,
    "requires_real_address" BOOLEAN NOT NULL DEFAULT false,
    "forbidden_words" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "message_guidelines" TEXT,
    "population" BIGINT,
    "internet_penetration" DOUBLE PRECISION,
    "democracy_index" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_verified" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legislative_channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legislative_body" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "body_name" TEXT NOT NULL,
    "body_type" TEXT NOT NULL,
    "member_count" INTEGER NOT NULL,
    "member_title" TEXT NOT NULL,
    "email_pattern" TEXT,
    "api_endpoint" TEXT,
    "term_length_years" INTEGER NOT NULL,
    "last_election" TIMESTAMP(3),
    "next_election" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legislative_body_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_adaptation" (
    "id" TEXT NOT NULL,
    "source_template_id" TEXT NOT NULL,
    "target_country_code" TEXT NOT NULL,
    "target_language" TEXT NOT NULL,
    "adapted_title" TEXT NOT NULL,
    "adapted_subject" TEXT,
    "adapted_body" TEXT NOT NULL,
    "currency_symbol" TEXT,
    "number_format" TEXT,
    "local_examples" JSONB,
    "local_officials" JSONB,
    "local_data_sources" JSONB,
    "tone_adjustment" TEXT,
    "cultural_notes" TEXT,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "success_rate" DOUBLE PRECISION,
    "viral_coefficient" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_adaptation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_event" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "funnel_id" TEXT,
    "campaign_id" TEXT,
    "variation_id" TEXT,

    CONSTRAINT "analytics_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_event_property" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "analytics_event_property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_funnel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_funnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_funnel_step" (
    "id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,

    CONSTRAINT "analytics_funnel_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "budget" DOUBLE PRECISION,

    CONSTRAINT "analytics_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_variation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "analytics_variation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "template_slug_key" ON "template"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "account_provider_provider_account_id_key" ON "account"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "congressional_office_office_code_key" ON "congressional_office"("office_code");

-- CreateIndex
CREATE UNIQUE INDEX "representative_bioguide_id_key" ON "representative"("bioguide_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_representatives_user_id_representative_id_key" ON "user_representatives"("user_id", "representative_id");

-- CreateIndex
CREATE UNIQUE INDEX "template_personalization_user_id_template_id_variable_name_key" ON "template_personalization"("user_id", "template_id", "variable_name");

-- CreateIndex
CREATE INDEX "ai_suggestions_template_id_variable_name_idx" ON "ai_suggestions"("template_id", "variable_name");

-- CreateIndex
CREATE UNIQUE INDEX "user_writing_style_user_id_key" ON "user_writing_style"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "template_analytics_template_id_variable_name_date_key" ON "template_analytics"("template_id", "variable_name", "date");

-- CreateIndex
CREATE INDEX "user_activation_template_id_activation_time_idx" ON "user_activation"("template_id", "activation_time");

-- CreateIndex
CREATE INDEX "user_activation_source_user_id_activation_time_idx" ON "user_activation"("source_user_id", "activation_time");

-- CreateIndex
CREATE UNIQUE INDEX "user_activation_user_id_template_id_key" ON "user_activation"("user_id", "template_id");

-- CreateIndex
CREATE INDEX "template_morphism_transformation_type_similarity_score_idx" ON "template_morphism"("transformation_type", "similarity_score");

-- CreateIndex
CREATE UNIQUE INDEX "template_morphism_source_template_id_target_template_id_key" ON "template_morphism"("source_template_id", "target_template_id");

-- CreateIndex
CREATE INDEX "political_field_state_timestamp_idx" ON "political_field_state"("timestamp");

-- CreateIndex
CREATE INDEX "local_political_bubble_center_user_id_radius_miles_idx" ON "local_political_bubble"("center_user_id", "radius_miles");

-- CreateIndex
CREATE INDEX "local_political_bubble_bubble_strength_idx" ON "local_political_bubble"("bubble_strength");

-- CreateIndex
CREATE INDEX "community_intersection_intersection_strength_idx" ON "community_intersection"("intersection_strength");

-- CreateIndex
CREATE UNIQUE INDEX "community_intersection_community_a_community_b_key" ON "community_intersection"("community_a", "community_b");

-- CreateIndex
CREATE INDEX "political_dead_end_decay_rate_max_reach_miles_idx" ON "political_dead_end"("decay_rate", "max_reach_miles");

-- CreateIndex
CREATE INDEX "community_lifecycle_community_type_current_status_idx" ON "community_lifecycle"("community_type", "current_status");

-- CreateIndex
CREATE INDEX "community_lifecycle_formation_date_idx" ON "community_lifecycle"("formation_date");

-- CreateIndex
CREATE UNIQUE INDEX "user_context_stack_user_id_key" ON "user_context_stack"("user_id");

-- CreateIndex
CREATE INDEX "political_flow_timestamp_flow_strength_idx" ON "political_flow"("timestamp", "flow_strength");

-- CreateIndex
CREATE INDEX "political_uncertainty_certainty_level_change_likelihood_idx" ON "political_uncertainty"("certainty_level", "change_likelihood");

-- CreateIndex
CREATE UNIQUE INDEX "political_uncertainty_user_id_template_id_key" ON "political_uncertainty"("user_id", "template_id");

-- CreateIndex
CREATE UNIQUE INDEX "legislative_channel_country_code_key" ON "legislative_channel"("country_code");

-- CreateIndex
CREATE INDEX "legislative_channel_access_tier_is_active_idx" ON "legislative_channel"("access_tier", "is_active");

-- CreateIndex
CREATE INDEX "legislative_channel_country_code_idx" ON "legislative_channel"("country_code");

-- CreateIndex
CREATE INDEX "legislative_body_channel_id_idx" ON "legislative_body"("channel_id");

-- CreateIndex
CREATE INDEX "template_adaptation_target_country_code_is_active_idx" ON "template_adaptation"("target_country_code", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "template_adaptation_source_template_id_target_country_code__key" ON "template_adaptation"("source_template_id", "target_country_code", "target_language");

-- CreateIndex
CREATE INDEX "analytics_event_session_id_timestamp_idx" ON "analytics_event"("session_id", "timestamp");

-- CreateIndex
CREATE INDEX "analytics_event_user_id_timestamp_idx" ON "analytics_event"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "analytics_event_name_timestamp_idx" ON "analytics_event"("name", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_event_property_event_id_name_key" ON "analytics_event_property"("event_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_funnel_name_key" ON "analytics_funnel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_funnel_step_funnel_id_step_order_key" ON "analytics_funnel_step"("funnel_id", "step_order");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_campaign_name_key" ON "analytics_campaign"("name");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_variation_name_key" ON "analytics_variation"("name");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template" ADD CONSTRAINT "template_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_campaign" ADD CONSTRAINT "template_campaign_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_campaign" ADD CONSTRAINT "template_campaign_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_representatives" ADD CONSTRAINT "user_representatives_representative_id_fkey" FOREIGN KEY ("representative_id") REFERENCES "representative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_representatives" ADD CONSTRAINT "user_representatives_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_personalization" ADD CONSTRAINT "template_personalization_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_personalization" ADD CONSTRAINT "template_personalization_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_writing_style" ADD CONSTRAINT "user_writing_style_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_analytics" ADD CONSTRAINT "template_analytics_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activation" ADD CONSTRAINT "user_activation_source_user_id_fkey" FOREIGN KEY ("source_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activation" ADD CONSTRAINT "user_activation_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activation" ADD CONSTRAINT "user_activation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_coordinates" ADD CONSTRAINT "user_coordinates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_morphism" ADD CONSTRAINT "template_morphism_source_template_id_fkey" FOREIGN KEY ("source_template_id") REFERENCES "template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_morphism" ADD CONSTRAINT "template_morphism_target_template_id_fkey" FOREIGN KEY ("target_template_id") REFERENCES "template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_political_bubble" ADD CONSTRAINT "local_political_bubble_center_user_id_fkey" FOREIGN KEY ("center_user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "political_dead_end" ADD CONSTRAINT "political_dead_end_origin_user_id_fkey" FOREIGN KEY ("origin_user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_lifecycle" ADD CONSTRAINT "community_lifecycle_founding_template_id_fkey" FOREIGN KEY ("founding_template_id") REFERENCES "template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_context_stack" ADD CONSTRAINT "user_context_stack_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "political_uncertainty" ADD CONSTRAINT "political_uncertainty_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "political_uncertainty" ADD CONSTRAINT "political_uncertainty_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legislative_body" ADD CONSTRAINT "legislative_body_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "legislative_channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_adaptation" ADD CONSTRAINT "template_adaptation_source_template_id_fkey" FOREIGN KEY ("source_template_id") REFERENCES "template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_adaptation" ADD CONSTRAINT "template_adaptation_target_country_code_fkey" FOREIGN KEY ("target_country_code") REFERENCES "legislative_channel"("country_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "analytics_funnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "analytics_campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "analytics_variation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_event_property" ADD CONSTRAINT "analytics_event_property_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "analytics_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_funnel_step" ADD CONSTRAINT "analytics_funnel_step_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "analytics_funnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
