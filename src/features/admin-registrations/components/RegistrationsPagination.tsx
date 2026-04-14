import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  registrationsLength: number;
  currentPage: number;
  itemsPerPage: number;
  hasMore: boolean;
  onSetCurrentPage: (page: number) => void;
  onSetItemsPerPage: (size: number) => void;
};

export function RegistrationsPagination(props: Props) {
  const { registrationsLength, currentPage, itemsPerPage, hasMore, onSetCurrentPage, onSetItemsPerPage } = props;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-white border-t">
      <div className="text-sm text-gray-600">
        Showing {(currentPage - 1) * itemsPerPage + 1} to {(currentPage - 1) * itemsPerPage + registrationsLength}{" "}
        entries (Page {currentPage}
        {!hasMore ? " - Last Page" : ""})
      </div>

      <div className="flex items-center gap-2">
        <select
          value={itemsPerPage}
          onChange={(e) => {
            onSetItemsPerPage(Number(e.target.value));
          }}
          className="px-3 py-1 border border-gray-300 rounded text-sm"
        >
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onSetCurrentPage(1);
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
              onSetCurrentPage(currentPage - 1);
            }
          }}
          disabled={currentPage === 1}
          className="px-3 py-1"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>

        <span className="text-sm font-medium px-3">Page {currentPage}</span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (hasMore) {
              onSetCurrentPage(currentPage + 1);
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
}

