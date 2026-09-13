import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const productStatus = pgEnum("product_status", ["idea", "designing", "rendering", "ready", "published", "archived"]);
export const reviewStatus = pgEnum("review_status", ["pending", "approved", "needs_review", "rejected"]);
export const contentRating = pgEnum("content_rating", ["general", "18+", "sensitive"]);
export const renderStatus = pgEnum("render_status", ["queued", "running", "failed", "review", "approved"]);

export const phrases = pgTable("phrases", {
  id: uuid("id").defaultRandom().primaryKey(), frontText: text("front_text").notNull(), backText: text("back_text"),
  language: text("language").notNull().default("it"), rating: contentRating("rating").notNull().default("general"),
  review: reviewStatus("review").notNull().default("pending"), tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("phrases_rating_idx").on(t.rating), index("phrases_review_idx").on(t.review)]);

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(), publicId: text("public_id").notNull(), slug: text("slug").notNull(),
  phraseId: uuid("phrase_id").notNull().references(() => phrases.id, { onDelete: "restrict" }), status: productStatus("status").notNull().default("idea"),
  priceCents: integer("price_cents").notNull(), currency: text("currency").notNull().default("EUR"), fit: text("fit").notNull().default("oversize"),
  publishedAt: timestamp("published_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("products_public_id_uq").on(t.publicId), uniqueIndex("products_slug_uq").on(t.slug), index("products_status_idx").on(t.status)]);

export const variants = pgTable("variants", {
  id: uuid("id").defaultRandom().primaryKey(), productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sku: text("sku").notNull(), color: text("color").notNull(), size: text("size").notNull(), stockOnHand: integer("stock_on_hand").notNull().default(0), active: boolean("active").notNull().default(true),
}, (t) => [uniqueIndex("variants_sku_uq").on(t.sku), index("variants_product_idx").on(t.productId)]);

export const productAssets = pgTable("product_assets", {
  id: uuid("id").defaultRandom().primaryKey(), productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  view: text("view").notNull(), storageKey: text("storage_key").notNull(), publicUrl: text("public_url").notNull(), width: integer("width").notNull(), height: integer("height").notNull(), mimeType: text("mime_type").notNull(), approved: boolean("approved").notNull().default(false), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("assets_product_view_idx").on(t.productId, t.view)]);

export const renderJobs = pgTable("render_jobs", {
  id: uuid("id").defaultRandom().primaryKey(), productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }), status: renderStatus("status").notNull().default("queued"),
  promptVersion: text("prompt_version").notNull(), provider: text("provider"), attempt: integer("attempt").notNull().default(0), input: jsonb("input").notNull(), output: jsonb("output"), error: text("error"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("render_jobs_status_idx").on(t.status), index("render_jobs_product_idx").on(t.productId)]);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(), externalPaymentId: text("external_payment_id"), email: text("email").notNull(), status: text("status").notNull(), totalCents: integer("total_cents").notNull(), currency: text("currency").notNull().default("EUR"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("orders_payment_uq").on(t.externalPaymentId), index("orders_email_idx").on(t.email)]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(), orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }), variantId: uuid("variant_id").notNull().references(() => variants.id, { onDelete: "restrict" }), quantity: integer("quantity").notNull(), unitPriceCents: integer("unit_price_cents").notNull(),
}, (t) => [index("order_items_order_idx").on(t.orderId)]);
