CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email CHARACTER VARYING(255) NOT NULL UNIQUE,
    password CHARACTER VARYING(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    description TEXT NOT NULL,
    date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status CHARACTER VARYING(255) NOT NULL DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    -- admin_user_id is nullable because the public booking endpoint
    -- (POST /appointments, no auth) also writes an audit row so we
    -- can trace which device booked. Matches NestJS migration
    -- 20260406_004_audit_log_nullable_admin.ts.
    admin_user_id UUID REFERENCES admin_users(id) ON DELETE RESTRICT,
    action CHARACTER VARYING(255) NOT NULL,
    changes TEXT NOT NULL,
    -- ip_address (VARCHAR 45 = max IPv6 length) and user_agent
    -- (VARCHAR 512) are required for GDPR-grade incident response.
    -- Matches NestJS migration 20260407_005_audit_log_ip_user_agent.ts.
    ip_address CHARACTER VARYING(45),
    user_agent CHARACTER VARYING(512),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
