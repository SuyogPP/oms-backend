-- ====================================================================================================
-- DIEZ Outsource Management System (OMS) — Database Migration Script
-- Onboarding: Candidate Access Tokens (Third Surface / Candidate Joining Readiness)
--
-- Target Database : OMS_DB_Prod
-- Target Schema   : onboarding
-- Reference Spec  : docs/CANDIDATE-JOINING-READINESS.md Part 1
-- ====================================================================================================

USE [OMS_DB_Prod];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Create onboarding schema if it does not exist
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'onboarding')
BEGIN
    EXEC('CREATE SCHEMA onboarding');
    PRINT '    [+] Created schema [onboarding].';
END
ELSE
BEGIN
    PRINT '    [-] Schema [onboarding] already exists.';
END
GO

-- 2. Create onboarding.CandidateAccessTokens table
PRINT '>>> Creating table [onboarding].[CandidateAccessTokens]...';

IF OBJECT_ID('onboarding.CandidateAccessTokens', 'U') IS NULL
BEGIN
    CREATE TABLE onboarding.CandidateAccessTokens (
        TokenId       UNIQUEIDENTIFIER NOT NULL DEFAULT (NEWSEQUENTIALID()),
        OnboardingId  UNIQUEIDENTIFIER NOT NULL,
        token_hash     VARBINARY(32)    NOT NULL,   -- SHA-256, same discipline as
                                                    -- auth.tbl_User_Invitations
        expires_at     DATETIME2(3)     NOT NULL,
        ConsumedCount INT              NOT NULL DEFAULT (0),
        revoked_at     DATETIME2(3)     NULL,
        created_at     DATETIME2(3)     NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_CandidateAccessTokens PRIMARY KEY (TokenId)
    );

    PRINT '    [+] Created table [onboarding].[CandidateAccessTokens].';
END
ELSE
BEGIN
    PRINT '    [-] Table [onboarding].[CandidateAccessTokens] already exists.';
END
GO

-- 3. Unique index on token_hash
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'UX_CandidateAccessTokens_Hash' 
      AND object_id = OBJECT_ID('onboarding.CandidateAccessTokens')
)
BEGIN
    CREATE UNIQUE INDEX UX_CandidateAccessTokens_Hash
        ON onboarding.CandidateAccessTokens (token_hash);

    PRINT '    [+] Created index [UX_CandidateAccessTokens_Hash].';
END
ELSE
BEGIN
    PRINT '    [-] Index [UX_CandidateAccessTokens_Hash] already exists.';
END
GO
