/**
 * Loading State Components
 *
 * Provides reusable loading skeleton components for consistent UX
 * across the application while data is being fetched.
 */

interface LoadingSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Generic loading bar skeleton
 */
function LoadingBar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      style={{ minHeight: "1rem" }}
    />
  );
}

/**
 * Table Loading Skeleton
 *
 * Displays a loading skeleton for table layouts.
 *
 * @example
 * <Suspense fallback={<TableLoadingSkeleton rows={5} columns={4} />}>
 *   <DataTable />
 * </Suspense>
 */
export function TableLoadingSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="w-full">
      {/* Table header */}
      <div
        className="grid gap-4 p-4 border-b border-gray-200 bg-gray-50"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <LoadingBar key={i} className="h-4" />
        ))}
      </div>

      {/* Table rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-4 p-4 border-b border-gray-100"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <LoadingBar key={colIndex} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Card Loading Skeleton
 *
 * Displays a loading skeleton for card layouts.
 *
 * @example
 * <Suspense fallback={<CardLoadingSkeleton count={3} />}>
 *   <CourseCards />
 * </Suspense>
 */
export function CardLoadingSkeleton({ count = 3 }: LoadingSkeletonProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
        >
          {/* Card image placeholder */}
          <div className="w-full h-48 bg-gray-200 rounded-lg mb-4" />

          {/* Card title */}
          <div className="h-6 bg-gray-200 rounded mb-3" />

          {/* Card description - 3 lines */}
          <div className="space-y-2 mb-4">
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>

          {/* Card footer */}
          <div className="flex gap-3 mt-4">
            <div className="h-10 bg-gray-200 rounded flex-1" />
            <div className="h-10 bg-gray-200 rounded w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Form Loading Skeleton
 *
 * Displays a loading skeleton for form layouts.
 *
 * @example
 * <Suspense fallback={<FormLoadingSkeleton fields={5} />}>
 *   <UserForm />
 * </Suspense>
 */
export function FormLoadingSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="space-y-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="animate-pulse">
            {/* Field label */}
            <div className="h-4 bg-gray-200 rounded w-32 mb-2" />

            {/* Field input */}
            <div className="h-10 bg-gray-200 rounded w-full" />
          </div>
        ))}

        {/* Form buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <div className="animate-pulse h-10 bg-gray-200 rounded w-24" />
          <div className="animate-pulse h-10 bg-gray-200 rounded w-24" />
        </div>
      </div>
    </div>
  );
}

/**
 * List Loading Skeleton
 *
 * Displays a loading skeleton for list layouts.
 *
 * @example
 * <Suspense fallback={<ListLoadingSkeleton items={8} />}>
 *   <NotificationList />
 * </Suspense>
 */
export function ListLoadingSkeleton({ items = 8 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg"
        >
          {/* Avatar/Icon */}
          <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />

          {/* Content */}
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>

          {/* Action button */}
          <div className="w-20 h-8 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Dashboard Stats Loading Skeleton
 *
 * Displays a loading skeleton for dashboard stat cards.
 *
 * @example
 * <Suspense fallback={<DashboardStatsLoadingSkeleton />}>
 *   <DashboardStats />
 * </Suspense>
 */
export function DashboardStatsLoadingSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
        >
          {/* Icon placeholder */}
          <div className="w-12 h-12 bg-gray-200 rounded-lg mb-4" />

          {/* Stat value */}
          <div className="h-8 bg-gray-200 rounded w-20 mb-2" />

          {/* Stat label */}
          <div className="h-4 bg-gray-200 rounded w-32" />
        </div>
      ))}
    </div>
  );
}

/**
 * Profile Loading Skeleton
 *
 * Displays a loading skeleton for profile pages.
 *
 * @example
 * <Suspense fallback={<ProfileLoadingSkeleton />}>
 *   <UserProfile />
 * </Suspense>
 */
export function ProfileLoadingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="animate-pulse bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
        {/* Profile header */}
        <div className="flex items-center gap-6 mb-8">
          {/* Avatar */}
          <div className="w-24 h-24 bg-gray-200 rounded-full" />

          {/* Name and title */}
          <div className="flex-1">
            <div className="h-8 bg-gray-200 rounded w-48 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
        </div>

        {/* Profile sections */}
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="h-5 bg-gray-200 rounded w-40 mb-3" />
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Content Loading Skeleton
 *
 * Generic content skeleton with heading and paragraphs.
 *
 * @example
 * <Suspense fallback={<ContentLoadingSkeleton />}>
 *   <ArticleContent />
 * </Suspense>
 */
export function ContentLoadingSkeleton() {
  return (
    <div className="animate-pulse max-w-4xl mx-auto space-y-6">
      {/* Heading */}
      <div className="h-10 bg-gray-200 rounded w-3/4 mb-4" />

      {/* Subheading */}
      <div className="h-6 bg-gray-200 rounded w-1/2 mb-6" />

      {/* Paragraphs */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-4/5" />
        </div>
      ))}
    </div>
  );
}

/**
 * Page Loading Spinner
 *
 * Full-page loading spinner for page transitions.
 *
 * @example
 * <PageLoadingSpinner />
 */
export function PageLoadingSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent" />
        <p className="mt-4 text-gray-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}

/**
 * Inline Loading Spinner
 *
 * Small inline loading spinner for buttons and inline content.
 *
 * @example
 * <button disabled>
 *   <InlineLoadingSpinner /> Saving...
 * </button>
 */
export function InlineLoadingSpinner({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-3",
  };

  return (
    <div
      className={`inline-block animate-spin rounded-full border-current border-t-transparent ${sizeClasses[size]}`}
      role="status"
      aria-label="Loading"
    />
  );
}

/**
 * Empty State
 *
 * Displays an empty state with optional message and action.
 *
 * @example
 * <EmptyState
 *   icon="📋"
 *   title="No items found"
 *   message="Get started by creating your first item"
 *   action={{ label: "Create Item", href: "/create" }}
 * />
 */
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: string;
  title: string;
  message?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="text-center py-12 px-4">
      {icon && (
        <div className="text-6xl mb-4" role="img" aria-label={title}>
          {icon}
        </div>
      )}
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      {message && <p className="text-gray-600 mb-6 max-w-md mx-auto">{message}</p>}
      {action && (
        <>
          {action.href ? (
            <a
              href={action.href}
              className="inline-block px-6 py-3 bg-purple-600 text-white rounded-full font-semibold hover:bg-purple-700 transition-colors"
            >
              {action.label}
            </a>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-block px-6 py-3 bg-purple-600 text-white rounded-full font-semibold hover:bg-purple-700 transition-colors"
            >
              {action.label}
            </button>
          )}
        </>
      )}
    </div>
  );
}
