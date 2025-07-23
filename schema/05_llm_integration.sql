-- AI-Optimized Golf Parlay Analytics Schema
-- Phase 5: LLM Integration Tables
-- Designed for natural language processing, insights generation, and AI-powered analysis

-- =========================================
-- LLM CONTENT AND INSIGHTS TABLES
-- =========================================

-- Player Narratives - AI-generated player stories and insights
CREATE TABLE player_narratives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    player_id UUID NOT NULL REFERENCES players(id),
    tournament_id UUID REFERENCES tournaments(id), -- NULL for general narratives
    
    -- Narrative type and content
    narrative_type TEXT NOT NULL CHECK (narrative_type IN (
        'tournament_preview', 'round_recap', 'performance_analysis', 
        'trend_analysis', 'betting_insight', 'course_fit_analysis',
        'head_to_head_comparison', 'season_summary', 'career_milestone'
    )),
    
    -- Content
    title TEXT NOT NULL,
    summary TEXT NOT NULL, -- Short summary for quick consumption
    full_content TEXT NOT NULL, -- Complete narrative
    key_insights JSONB, -- Structured key takeaways
    
    -- Supporting data references
    data_points_used JSONB, -- Which data points informed this narrative
    statistical_evidence JSONB, -- Supporting statistics
    comparative_context JSONB, -- Comparisons to other players/tournaments
    
    -- AI generation metadata
    generated_by TEXT NOT NULL DEFAULT 'claude-3.5', -- AI model used
    generation_prompt TEXT, -- Prompt used to generate content
    generation_confidence DECIMAL(4,3) CHECK (generation_confidence BETWEEN 0 AND 1),
    
    -- Content quality metrics
    readability_score DECIMAL(4,1), -- Flesch reading ease score
    engagement_score DECIMAL(4,3), -- Predicted user engagement
    accuracy_validated BOOLEAN DEFAULT false,
    human_reviewed BOOLEAN DEFAULT false,
    
    -- Betting relevance
    betting_implications JSONB, -- How this narrative affects betting markets
    edge_opportunities TEXT[], -- Potential betting edges identified
    market_sentiment_impact DECIMAL(4,3), -- Expected impact on market sentiment
    
    -- Content targeting
    audience_type TEXT CHECK (audience_type IN (
        'casual_fans', 'serious_bettors', 'fantasy_players', 'analysts', 'media'
    )),
    complexity_level TEXT CHECK (complexity_level IN ('basic', 'intermediate', 'advanced')),
    
    -- Publishing and visibility
    published BOOLEAN DEFAULT false,
    publish_date TIMESTAMPTZ,
    visibility TEXT DEFAULT 'internal' CHECK (visibility IN ('internal', 'public', 'premium')),
    
    -- Performance tracking
    view_count INTEGER DEFAULT 0,
    user_ratings JSONB, -- User feedback and ratings
    engagement_metrics JSONB, -- Click-through, time spent, etc.
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- When narrative becomes outdated
    
    -- Full-text search
    content_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', title || ' ' || summary || ' ' || full_content)
    ) STORED
);

-- Tournament Insights - AI-generated tournament analysis and predictions
CREATE TABLE tournament_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    
    -- Insight type
    insight_type TEXT NOT NULL CHECK (insight_type IN (
        'pre_tournament_analysis', 'daily_recap', 'round_analysis',
        'cut_predictions', 'leaderboard_analysis', 'weather_impact',
        'field_strength_analysis', 'betting_market_analysis', 'parlay_opportunities'
    )),
    
    -- Content
    headline TEXT NOT NULL,
    executive_summary TEXT NOT NULL,
    detailed_analysis TEXT NOT NULL,
    
    -- Structured insights
    key_storylines JSONB, -- Main narrative threads
    player_spotlight JSONB, -- Featured players and why
    statistical_highlights JSONB, -- Notable stats and trends
    
    -- Predictions and forecasts
    predictions JSONB, -- AI predictions for tournament outcomes
    confidence_levels JSONB, -- Confidence in each prediction
    upset_potential JSONB, -- Potential surprise performances
    
    -- Market analysis
    betting_market_insights JSONB, -- Analysis of betting markets
    value_opportunities JSONB, -- Identified betting edges
    parlay_recommendations JSONB, -- Recommended parlay combinations
    contrarian_plays JSONB, -- Counter-narrative betting opportunities
    
    -- Data foundation
    analysis_based_on JSONB, -- Data sources and methodology
    model_inputs JSONB, -- Which models contributed to insights
    historical_comparisons JSONB, -- Similar tournaments/situations
    
    -- AI generation details
    generated_by TEXT DEFAULT 'claude-3.5',
    generation_timestamp TIMESTAMPTZ DEFAULT NOW(),
    generation_duration_ms INTEGER,
    tokens_used INTEGER,
    
    -- Content validation
    fact_checked BOOLEAN DEFAULT false,
    expert_reviewed BOOLEAN DEFAULT false,
    accuracy_score DECIMAL(4,3), -- Post-tournament accuracy assessment
    
    -- Distribution and engagement
    target_distribution TEXT[] DEFAULT ARRAY['web', 'email', 'api'],
    social_media_optimized BOOLEAN DEFAULT false,
    mobile_optimized BOOLEAN DEFAULT false,
    
    -- Performance metrics
    distribution_reach INTEGER DEFAULT 0,
    user_interactions JSONB, -- Likes, shares, comments, etc.
    bet_influence_tracking JSONB, -- How insights influenced actual betting
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    relevance_expires_at TIMESTAMPTZ,
    
    -- Full-text search
    insight_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', headline || ' ' || executive_summary || ' ' || detailed_analysis)
    ) STORED
);

-- AI Conversations - Store chat interactions for learning and improvement
CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Session information
    session_id UUID NOT NULL,
    user_id UUID, -- Reference to user if authenticated
    conversation_type TEXT CHECK (conversation_type IN (
        'betting_advice', 'player_analysis', 'tournament_preview',
        'statistical_query', 'parlay_optimization', 'general_golf'
    )),
    
    -- Conversation content
    user_message TEXT NOT NULL,
    system_response TEXT NOT NULL,
    context_used JSONB, -- What data/context informed the response
    
    -- AI processing details
    ai_model TEXT NOT NULL DEFAULT 'claude-3.5',
    prompt_template TEXT, -- Which prompt template was used
    processing_time_ms INTEGER,
    tokens_used INTEGER,
    
    -- Response quality
    confidence_score DECIMAL(4,3) CHECK (confidence_score BETWEEN 0 AND 1),
    hallucination_risk DECIMAL(4,3), -- Risk of inaccurate information
    response_relevance DECIMAL(4,3), -- How relevant response was to query
    
    -- User feedback
    user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
    user_feedback TEXT,
    helpful_flag BOOLEAN,
    follow_up_questions TEXT[],
    
    -- Data access patterns
    tables_queried TEXT[], -- Which database tables were accessed
    external_apis_used TEXT[], -- External data sources used
    calculation_methods JSONB, -- How any calculations were performed
    
    -- Learning and improvement
    error_detected BOOLEAN DEFAULT false,
    error_description TEXT,
    suggested_improvement TEXT,
    training_data_candidate BOOLEAN DEFAULT false,
    
    -- Privacy and compliance
    contains_pii BOOLEAN DEFAULT false,
    data_retention_category TEXT DEFAULT 'standard',
    anonymized BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    
    -- Indexes will handle performance
    INDEX (session_id, created_at),
    INDEX (conversation_type, created_at),
    INDEX (user_id, created_at) WHERE user_id IS NOT NULL
);

-- Convert to hypertable for efficient storage and querying
SELECT create_hypertable('ai_conversations', 'created_at', 
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

-- Knowledge Base - Structured golf knowledge for AI context
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Knowledge classification
    knowledge_type TEXT NOT NULL CHECK (knowledge_type IN (
        'rule_explanation', 'statistical_concept', 'betting_strategy',
        'course_knowledge', 'player_biography', 'tournament_history',
        'golf_terminology', 'analytical_method', 'market_dynamics'
    )),
    category TEXT NOT NULL,
    subcategory TEXT,
    
    -- Content
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    detailed_content TEXT NOT NULL,
    
    -- Structured knowledge
    key_concepts JSONB, -- Important concepts and definitions
    related_topics TEXT[], -- IDs of related knowledge base entries
    prerequisites TEXT[], -- Knowledge needed to understand this
    
    -- Practical applications
    use_cases JSONB, -- When/how to apply this knowledge
    examples JSONB, -- Concrete examples and case studies
    common_misconceptions JSONB, -- Frequent misunderstandings
    
    -- Data connections
    relevant_tables TEXT[], -- Database tables this knowledge relates to
    relevant_metrics TEXT[], -- Specific metrics this explains
    calculation_formulas JSONB, -- Mathematical formulas if applicable
    
    -- AI integration
    embedding_vector VECTOR(384), -- Semantic embedding for retrieval
    retrieval_keywords TEXT[], -- Keywords for text-based retrieval
    context_relevance JSONB, -- When this knowledge is most relevant
    
    -- Content management
    content_version INTEGER DEFAULT 1,
    author TEXT, -- Who created/last updated this knowledge
    source_references TEXT[], -- External sources and citations
    
    -- Quality and validation
    accuracy_validated BOOLEAN DEFAULT false,
    expert_reviewed BOOLEAN DEFAULT false,
    user_helpfulness_rating DECIMAL(3,2),
    
    -- Usage tracking
    retrieval_count INTEGER DEFAULT 0,
    last_retrieved TIMESTAMPTZ,
    successful_applications INTEGER DEFAULT 0,
    
    -- Content status
    active BOOLEAN DEFAULT true,
    review_required BOOLEAN DEFAULT false,
    scheduled_review_date DATE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Full-text search
    knowledge_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', title || ' ' || description || ' ' || detailed_content)
    ) STORED,
    
    UNIQUE(knowledge_type, category, title)
);

-- =========================================
-- AI PROMPT TEMPLATES AND WORKFLOWS
-- =========================================

-- AI Prompt Templates - Reusable prompts for consistent AI interactions
CREATE TABLE ai_prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Template identification
    template_name TEXT NOT NULL UNIQUE,
    template_category TEXT NOT NULL CHECK (template_category IN (
        'player_analysis', 'tournament_preview', 'betting_advice',
        'statistical_explanation', 'parlay_optimization', 'market_analysis',
        'narrative_generation', 'data_interpretation'
    )),
    
    -- Template content
    system_prompt TEXT NOT NULL,
    user_prompt_template TEXT NOT NULL,
    context_requirements JSONB, -- What data context is needed
    
    -- Template parameters
    required_variables TEXT[] NOT NULL, -- Variables that must be provided
    optional_variables TEXT[] DEFAULT ARRAY[]::TEXT[],
    output_format JSONB, -- Expected output structure
    
    -- AI model configuration
    recommended_model TEXT DEFAULT 'claude-3.5',
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 4000,
    stop_sequences TEXT[],
    
    -- Quality controls
    validation_rules JSONB, -- Rules to validate AI responses
    post_processing_steps JSONB, -- Steps to clean/format output
    fallback_handling JSONB, -- What to do if template fails
    
    -- Performance tracking
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 100.0,
    average_response_quality DECIMAL(4,3),
    average_processing_time_ms INTEGER,
    
    -- Template evolution
    version INTEGER DEFAULT 1,
    parent_template_id UUID REFERENCES ai_prompt_templates(id),
    changelog JSONB, -- Version history and changes
    
    -- Status and governance
    active BOOLEAN DEFAULT true,
    approval_status TEXT DEFAULT 'draft' CHECK (approval_status IN (
        'draft', 'testing', 'approved', 'deprecated'
    )),
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    
    -- A/B testing
    ab_test_group TEXT, -- For testing different versions
    performance_comparison JSONB, -- Comparison with other versions
    
    -- Metadata
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Workflow Executions - Track automated AI workflows
CREATE TABLE ai_workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Workflow identification
    workflow_name TEXT NOT NULL,
    workflow_type TEXT NOT NULL CHECK (workflow_type IN (
        'daily_insights_generation', 'tournament_preview', 'player_analysis',
        'betting_opportunities_scan', 'market_analysis', 'parlay_optimization',
        'content_generation', 'data_validation'
    )),
    
    -- Execution context
    triggered_by TEXT NOT NULL CHECK (triggered_by IN (
        'schedule', 'manual', 'event', 'api_request', 'user_action'
    )),
    trigger_details JSONB, -- Details about what triggered execution
    
    -- Execution details
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'running' CHECK (status IN (
        'queued', 'running', 'completed', 'failed', 'cancelled'
    )),
    
    -- Processing steps
    steps_completed INTEGER DEFAULT 0,
    total_steps INTEGER,
    current_step_description TEXT,
    step_details JSONB, -- Detailed log of each step
    
    -- Resource usage
    ai_models_used JSONB, -- Which AI models were invoked
    total_tokens_consumed INTEGER DEFAULT 0,
    total_api_cost DECIMAL(8,4) DEFAULT 0,
    processing_duration_ms INTEGER,
    
    -- Input and output
    input_data JSONB, -- Input parameters and data
    output_data JSONB, -- Generated results
    artifacts_created TEXT[], -- Files, records, or content created
    
    -- Quality metrics
    output_quality_score DECIMAL(4,3),
    validation_passed BOOLEAN,
    human_review_required BOOLEAN DEFAULT false,
    
    -- Error handling
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Performance analysis
    bottleneck_steps JSONB, -- Which steps took longest
    optimization_suggestions JSONB, -- How to improve performance
    
    -- Dependencies and impacts
    depends_on_executions UUID[], -- Other executions this depends on
    impacts_downstream BOOLEAN DEFAULT false,
    notification_sent BOOLEAN DEFAULT false,
    
    -- Metadata
    execution_environment TEXT DEFAULT 'production',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX (workflow_name, started_at DESC),
    INDEX (status, created_at),
    INDEX (triggered_by, workflow_type)
);

-- Convert to hypertable for efficient querying of execution history
SELECT create_hypertable('ai_workflow_executions', 'started_at', 
    chunk_time_interval => INTERVAL '1 week',
    if_not_exists => TRUE
);

-- =========================================
-- SEMANTIC SEARCH AND RETRIEVAL
-- =========================================

-- Semantic Search Index - For AI context retrieval
CREATE TABLE semantic_search_index (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Content identification
    content_type TEXT NOT NULL CHECK (content_type IN (
        'player_profile', 'tournament_data', 'statistical_insight',
        'betting_analysis', 'historical_performance', 'course_analysis',
        'narrative_content', 'knowledge_base_entry'
    )),
    content_id UUID NOT NULL, -- Reference to the actual content
    content_title TEXT NOT NULL,
    content_summary TEXT,
    
    -- Semantic embeddings
    content_embedding VECTOR(1024), -- High-dimensional embedding
    title_embedding VECTOR(384), -- Embedding of just the title
    summary_embedding VECTOR(384), -- Embedding of summary
    
    -- Content metadata
    content_freshness DATE NOT NULL, -- When content was last updated
    relevance_tags TEXT[], -- Manual tags for relevance
    context_categories TEXT[], -- When this content is most relevant
    
    -- Usage patterns
    retrieval_frequency INTEGER DEFAULT 0,
    last_retrieved TIMESTAMPTZ,
    user_relevance_ratings JSONB, -- User feedback on relevance
    
    -- Access control
    visibility_level TEXT DEFAULT 'internal' CHECK (visibility_level IN (
        'public', 'internal', 'premium', 'restricted'
    )),
    required_permissions TEXT[],
    
    -- Content relationships
    related_content_ids UUID[], -- IDs of related content
    semantic_similarity_scores JSONB, -- Precomputed similarity scores
    
    -- Search optimization
    boost_score DECIMAL(4,3) DEFAULT 1.0, -- Boost in search results
    deprecation_date DATE, -- When content becomes less relevant
    
    -- Metadata
    indexed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX (content_type, content_freshness DESC),
    INDEX (visibility_level, boost_score DESC)
);

-- Create vector similarity indexes
CREATE INDEX idx_semantic_content_embedding ON semantic_search_index 
    USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 1000);
CREATE INDEX idx_semantic_title_embedding ON semantic_search_index 
    USING ivfflat (title_embedding vector_cosine_ops) WITH (lists = 500);

-- =========================================
-- INDEXES FOR LLM PERFORMANCE
-- =========================================

-- Player narratives indexes
CREATE INDEX idx_narratives_player_type ON player_narratives(player_id, narrative_type);
CREATE INDEX idx_narratives_tournament ON player_narratives(tournament_id) WHERE tournament_id IS NOT NULL;
CREATE INDEX idx_narratives_published ON player_narratives(published, publish_date) WHERE published = true;
CREATE INDEX idx_narratives_content_search ON player_narratives USING gin(content_vector);
CREATE INDEX idx_narratives_audience ON player_narratives(audience_type, complexity_level);

-- Tournament insights indexes
CREATE INDEX idx_insights_tournament_type ON tournament_insights(tournament_id, insight_type);
CREATE INDEX idx_insights_content_search ON tournament_insights USING gin(insight_vector);
CREATE INDEX idx_insights_generation_time ON tournament_insights(generation_timestamp DESC);
CREATE INDEX idx_insights_accuracy ON tournament_insights(accuracy_score DESC) WHERE accuracy_score IS NOT NULL;

-- AI conversations indexes (handled by hypertable)
CREATE INDEX idx_conversations_session ON ai_conversations(session_id, created_at DESC);
CREATE INDEX idx_conversations_type ON ai_conversations(conversation_type, created_at DESC);
CREATE INDEX idx_conversations_feedback ON ai_conversations(user_rating, helpful_flag) 
    WHERE user_rating IS NOT NULL;

-- Knowledge base indexes
CREATE INDEX idx_knowledge_type_category ON knowledge_base(knowledge_type, category);
CREATE INDEX idx_knowledge_content_search ON knowledge_base USING gin(knowledge_vector);
CREATE INDEX idx_knowledge_embedding ON knowledge_base 
    USING ivfflat (embedding_vector vector_cosine_ops) WITH (lists = 200);
CREATE INDEX idx_knowledge_active ON knowledge_base(active, retrieval_count DESC) WHERE active = true;

-- Prompt templates indexes
CREATE INDEX idx_templates_category ON ai_prompt_templates(template_category, active) WHERE active = true;
CREATE INDEX idx_templates_performance ON ai_prompt_templates(success_rate DESC, usage_count DESC);
CREATE INDEX idx_templates_approval ON ai_prompt_templates(approval_status, version);

-- Workflow executions indexes (handled by hypertable)
CREATE INDEX idx_workflows_name_status ON ai_workflow_executions(workflow_name, status);
CREATE INDEX idx_workflows_type_trigger ON ai_workflow_executions(workflow_type, triggered_by);

-- =========================================
-- FUNCTIONS FOR LLM INTEGRATION
-- =========================================

-- Function to update retrieval statistics
CREATE OR REPLACE FUNCTION update_content_retrieval_stats(
    content_table TEXT,
    content_record_id UUID
) RETURNS VOID AS $$
BEGIN
    -- Update retrieval count and last retrieved timestamp
    EXECUTE format(
        'UPDATE %I SET retrieval_count = retrieval_count + 1, last_retrieved = NOW() WHERE id = $1',
        content_table
    ) USING content_record_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate semantic similarity
CREATE OR REPLACE FUNCTION calculate_semantic_similarity(
    embedding1 VECTOR,
    embedding2 VECTOR
) RETURNS DECIMAL AS $$
BEGIN
    -- Calculate cosine similarity between vectors
    RETURN 1 - (embedding1 <=> embedding2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comments
COMMENT ON TABLE player_narratives IS 'AI-generated player stories and insights for content and betting analysis';
COMMENT ON TABLE tournament_insights IS 'AI-generated tournament analysis and predictions with market implications';
COMMENT ON TABLE ai_conversations IS 'Chat interactions with AI for learning and improvement';
COMMENT ON TABLE knowledge_base IS 'Structured golf knowledge for AI context and retrieval';
COMMENT ON TABLE semantic_search_index IS 'Semantic search capabilities for AI content retrieval';

SELECT 'LLM integration tables created successfully! Ready for optimization structures.' as result;