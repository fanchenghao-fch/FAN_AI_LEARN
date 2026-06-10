-- ============================================================
-- 阿拉灯神丁 · 数据库初始化脚本
--
-- 数据库:   MySQL 8.0
-- 字符集:   utf8mb4 / utf8mb4_unicode_ci
-- 引擎:     InnoDB
-- 关联文档: 用户系统-方案设计文档.md
--
-- 用法:
--   Docker:
--     volumes:
--       - ./backend/init.sql:/docker-entrypoint-initdb.d/init.sql
--
--   本地:
--     mysql -u root -p quiz_platform < backend/init.sql
--
-- ============================================================

-- ── 创建数据库（如果不存在） ──────────────────────────────────

CREATE DATABASE IF NOT EXISTS quiz_platform
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE quiz_platform;

-- ============================================================
-- 1. 用户表
-- ============================================================

DROP TABLE IF EXISTS `check_ins`;
DROP TABLE IF EXISTS `wrong_questions`;
DROP TABLE IF EXISTS `quiz_sessions`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `level_configs`;

CREATE TABLE `users` (
    `id`          CHAR(36)      NOT NULL PRIMARY KEY COMMENT 'UUID',
    `open_id`     VARCHAR(64)   DEFAULT NULL              COMMENT '微信 openid',
    `union_id`    VARCHAR(64)   DEFAULT NULL              COMMENT '微信 unionid',
    `nickname`    VARCHAR(64)   NOT NULL DEFAULT '灯灯学员' COMMENT '用户昵称',
    `avatar_url`  VARCHAR(512)  DEFAULT NULL              COMMENT '头像 URL',
    `coins`       INT           NOT NULL DEFAULT 0        COMMENT '金币数量',
    `experience`  INT           NOT NULL DEFAULT 0        COMMENT '经验值',
    `level_id`    INT           NOT NULL DEFAULT 1        COMMENT '等级 ID',
    `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
    `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    UNIQUE KEY `uk_open_id` (`open_id`),
    INDEX      `idx_nickname` (`nickname`),
    INDEX      `idx_experience` (`experience`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 2. 闯关记录表
-- ============================================================

CREATE TABLE `quiz_sessions` (
    `id`           CHAR(36)      NOT NULL PRIMARY KEY COMMENT 'UUID',
    `user_id`      CHAR(36)      NOT NULL                 COMMENT 'FK → users.id',
    `quiz_id`      VARCHAR(64)   NOT NULL                 COMMENT 'quiz_xxxxxxxxxxxx',
    `domain`       VARCHAR(128)  NOT NULL DEFAULT ''      COMMENT '知识领域',
    `title`        VARCHAR(128)  NOT NULL DEFAULT ''      COMMENT '闯关标题',
    `score`        INT           NOT NULL DEFAULT 0       COMMENT '得分',
    `total`        INT           NOT NULL DEFAULT 0       COMMENT '总题数',
    `accuracy`     FLOAT         NOT NULL DEFAULT 0.0     COMMENT '正确率 (0-1)',
    `time_spent`   INT           NOT NULL DEFAULT 0       COMMENT '总用时（秒）',
    `coins_earned` INT           NOT NULL DEFAULT 0       COMMENT '本次获得金币',
    `combo_max`    INT           NOT NULL DEFAULT 0       COMMENT '最高连击',
    `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '闯关时间',

    INDEX      `idx_user_id` (`user_id`),
    INDEX      `idx_user_created` (`user_id`, `created_at`),
    INDEX      `idx_quiz_id` (`quiz_id`),
    CONSTRAINT `fk_session_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 3. 错题本表
-- ============================================================

CREATE TABLE `wrong_questions` (
    `id`              CHAR(36)      NOT NULL PRIMARY KEY COMMENT 'UUID',
    `user_id`         CHAR(36)      NOT NULL              COMMENT 'FK → users.id',
    `session_id`      CHAR(36)      NOT NULL              COMMENT 'FK → quiz_sessions.id',
    `question_id`     VARCHAR(32)   NOT NULL              COMMENT '原题目 ID',
    `content`         TEXT          NOT NULL              COMMENT '题目内容',
    `user_answer`     VARCHAR(512)  NOT NULL              COMMENT '用户错误答案',
    `correct_answer`  VARCHAR(512)  NOT NULL              COMMENT '正确答案',
    `explanation`     TEXT          NOT NULL              COMMENT '解析',
    `options`         TEXT          DEFAULT NULL          COMMENT 'JSON序列化的原始选项列表',
    `domain`          VARCHAR(128)  NOT NULL DEFAULT ''   COMMENT '知识领域（冗余，方便分组）',
    `resolved`        TINYINT       NOT NULL DEFAULT 0    COMMENT '0=待复习 1=已掌握',
    `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '错题时间',
    `resolved_at`     DATETIME      DEFAULT NULL          COMMENT '掌握时间',

    INDEX      `idx_user_domain` (`user_id`, `domain`),
    INDEX      `idx_user_resolved` (`user_id`, `resolved`),
    INDEX      `idx_user_question` (`user_id`, `question_id`),
    CONSTRAINT `fk_wrong_user`    FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)          ON DELETE CASCADE,
    CONSTRAINT `fk_wrong_session` FOREIGN KEY (`session_id`) REFERENCES `quiz_sessions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 4. 每日打卡表
-- ============================================================

CREATE TABLE `check_ins` (
    `id`          CHAR(36)      NOT NULL PRIMARY KEY COMMENT 'UUID',
    `user_id`     CHAR(36)      NOT NULL                 COMMENT 'FK → users.id',
    `check_date`  DATE          NOT NULL                 COMMENT '打卡日期',
    `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '打卡时间',

    UNIQUE KEY `uk_user_date` (`user_id`, `check_date`),
    INDEX      `idx_user_id` (`user_id`),
    CONSTRAINT `fk_checkin_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 5. 等级配置表
-- ============================================================

CREATE TABLE `level_configs` (
    `id`      INT           NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `level`   INT           NOT NULL                   COMMENT '等级数字',
    `title`   VARCHAR(32)   NOT NULL                   COMMENT '等级称号',
    `min_exp` INT           NOT NULL                   COMMENT '所需最低经验',

    UNIQUE KEY `uk_level` (`level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 种子数据: 等级称号
-- ============================================================

INSERT INTO `level_configs` (`level`, `title`, `min_exp`) VALUES
    (1, '初学萌新', 0),
    (2, '知识学徒', 100),
    (3, '学习达人', 300),
    (4, '百科高手', 600),
    (5, '博学大师', 1000);
