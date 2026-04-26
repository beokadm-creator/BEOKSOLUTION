import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RegistrationPaginationProps {
    loading: boolean;
    currentPage: number;
    itemsPerPage: number;
    setCurrentPage: (page: number) => void;
    setItemsPerPage: (size: number) => void;
    hasMore: boolean;
    registrationsCount: number;
}

export const RegistrationPagination: React.FC<RegistrationPaginationProps> = ({
    loading,
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    hasMore,
    registrationsCount,
}) => {
    if (loading || registrationsCount === 0) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-white border-t">
            <div className="text-sm text-gray-600">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {(currentPage - 1) * itemsPerPage + registrationsCount} entries (Page {currentPage}{!hasMore ? ' - Last Page' : ''})
            </div>

            <div className="flex items-center gap-2">
                {/* Page Size Selector */}
                <select
                    value={itemsPerPage}
                    onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                    }}
                    className="px-3 py-1 border border-gray-300 rounded text-sm"
                >
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                </select>

                {/* Previous Button */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setCurrentPage(1);
                    }}
                    disabled={currentPage === 1}
                    className="px-3 py-1"
                >
                    <ChevronLeft className="w-4 h-4" />
                    First
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        if (currentPage > 1) {
                            setCurrentPage(currentPage - 1);
                        }
                    }}
                    disabled={currentPage === 1}
                    className="px-3 py-1"
                >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                </Button>

                {/* Page Info */}
                <span className="text-sm font-medium px-3">
                    Page {currentPage}
                </span>

                {/* Next Button */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        if (hasMore) {
                            setCurrentPage(currentPage + 1);
                        }
                    }}
                    disabled={!hasMore}
                    className="px-3 py-1"
                >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
            </div>
        </div>
    );
};
