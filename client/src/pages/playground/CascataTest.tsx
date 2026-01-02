import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronLeft, ChevronRight, Columns } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import DashboardLayout from "@/components/DashboardLayout";

const PAGE_SIZE = 25;

export default function CascataTest() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [page, setPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [columnSearch, setColumnSearch] = useState("");
  const [columnSearch2, setColumnSearch2] = useState("");
  const [columnSearch3, setColumnSearch3] = useState("");
  const [columnSearch4, setColumnSearch4] = useState("");
  const [isColumnPopoverOpen, setIsColumnPopoverOpen] = useState(false);
  const [isColumnPopoverOpen2, setIsColumnPopoverOpen2] = useState(false);
  const [isColumnPopoverOpen3, setIsColumnPopoverOpen3] = useState(false);
  const [isColumnPopoverOpen4, setIsColumnPopoverOpen4] = useState(false);
  const [selectedColumn1, setSelectedColumn1] = useState<string>("property_admin_first_became_a_sql_date");
  const [selectedColumn2, setSelectedColumn2] = useState<string>("property_admin_pod");
  const [selectedColumn3, setSelectedColumn3] = useState<string>("property_sql_type");
  const [selectedColumn4, setSelectedColumn4] = useState<string>("property_admin_first_became_an_opportunity_date");
  const [selectedColumn5, setSelectedColumn5] = useState<string>("property_deal_geo_pods");
  const [selectedColumn6, setSelectedColumn6] = useState<string>("property_dealtype");
  const [selectedColumn7, setSelectedColumn7] = useState<string>("property_amount_in_home_currency");
  const [selectedColumn8, setSelectedColumn8] = useState<string>("property_type_of_sql_associated_to_deal");
  const [selectedColumn9, setSelectedColumn9] = useState<string>("property_closedate");
  const [columnSearch5, setColumnSearch5] = useState("");
  const [columnSearch6, setColumnSearch6] = useState("");
  const [columnSearch7, setColumnSearch7] = useState("");
  const [columnSearch8, setColumnSearch8] = useState("");
  const [columnSearch9, setColumnSearch9] = useState("");
  const [isColumnPopoverOpen5, setIsColumnPopoverOpen5] = useState(false);
  const [isColumnPopoverOpen6, setIsColumnPopoverOpen6] = useState(false);
  const [isColumnPopoverOpen7, setIsColumnPopoverOpen7] = useState(false);
  const [isColumnPopoverOpen8, setIsColumnPopoverOpen8] = useState(false);
  const [isColumnPopoverOpen9, setIsColumnPopoverOpen9] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());

  const { data, isLoading, isFetching } = trpc.dashboard.playground.cascataTest.useQuery({
    page,
    pageSize: PAGE_SIZE,
  });

  const { data: dealsData, isLoading: isDealsLoading, isFetching: isDealsFetching } = trpc.dashboard.playground.cascataTestDeals.useQuery({
    page: 1,
    pageSize: 25,
  });

  // Get all available columns from contacts table
  const allColumns = useMemo(() => {
    if (!data?.data || data.data.length === 0) return [];
    const columnSet = new Set<string>();
    // Collect all unique column names from all rows
    data.data.forEach((row) => {
      Object.keys(row).forEach((key) => columnSet.add(key));
    });
    // Return columns in a consistent order (alphabetically sorted)
    return Array.from(columnSet).sort();
  }, [data]);

  // Get all available columns from deals table
  const allDealColumns = useMemo(() => {
    if (!dealsData?.data || dealsData.data.length === 0) return [];
    const columnSet = new Set<string>();
    // Collect all unique column names from all rows
    dealsData.data.forEach((row) => {
      Object.keys(row).forEach((key) => columnSet.add(key));
    });
    // Return columns in a consistent order (alphabetically sorted)
    return Array.from(columnSet).sort();
  }, [dealsData]);

  // Update selectedColumns set when individual column selections change
  useEffect(() => {
    const newSet = new Set<string>();
    if (selectedColumn1) newSet.add(selectedColumn1);
    if (selectedColumn2) newSet.add(selectedColumn2);
    if (selectedColumn3) newSet.add(selectedColumn3);
    if (selectedColumn4) newSet.add(selectedColumn4);
    if (selectedColumn5) newSet.add(selectedColumn5);
    if (selectedColumn6) newSet.add(selectedColumn6);
    if (selectedColumn7) newSet.add(selectedColumn7);
    if (selectedColumn8) newSet.add(selectedColumn8);
    if (selectedColumn9) newSet.add(selectedColumn9);
    setSelectedColumns(newSet);
  }, [selectedColumn1, selectedColumn2, selectedColumn3, selectedColumn4, selectedColumn5, selectedColumn6, selectedColumn7, selectedColumn8, selectedColumn9]);

  // Filter columns based on search
  const filteredColumns = useMemo(() => {
    if (!columnSearch.trim()) return allColumns;
    const searchLower = columnSearch.toLowerCase();
    return allColumns.filter((col) => col.toLowerCase().includes(searchLower));
  }, [allColumns, columnSearch]);

  const filteredColumns2 = useMemo(() => {
    if (!columnSearch2.trim()) return allColumns;
    const searchLower = columnSearch2.toLowerCase();
    return allColumns.filter((col) => col.toLowerCase().includes(searchLower));
  }, [allColumns, columnSearch2]);

  const filteredColumns3 = useMemo(() => {
    if (!columnSearch3.trim()) return allColumns;
    const searchLower = columnSearch3.toLowerCase();
    return allColumns.filter((col) => col.toLowerCase().includes(searchLower));
  }, [allColumns, columnSearch3]);

  const filteredColumns4 = useMemo(() => {
    if (!columnSearch4.trim()) return allColumns;
    const searchLower = columnSearch4.toLowerCase();
    return allColumns.filter((col) => col.toLowerCase().includes(searchLower));
  }, [allColumns, columnSearch4]);

  const filteredColumns5 = useMemo(() => {
    if (!columnSearch5.trim()) return allDealColumns;
    const searchLower = columnSearch5.toLowerCase();
    return allDealColumns.filter((col) => col.toLowerCase().includes(searchLower));
  }, [allDealColumns, columnSearch5]);

  const filteredColumns6 = useMemo(() => {
    if (!columnSearch6.trim()) return allDealColumns;
    const searchLower = columnSearch6.toLowerCase();
    return allDealColumns.filter((col) => col.toLowerCase().includes(searchLower));
  }, [allDealColumns, columnSearch6]);

  const filteredColumns7 = useMemo(() => {
    if (!columnSearch7.trim()) return allDealColumns;
    const searchLower = columnSearch7.toLowerCase();
    return allDealColumns.filter((col) => col.toLowerCase().includes(searchLower));
  }, [allDealColumns, columnSearch7]);

  const filteredColumns8 = useMemo(() => {
    if (!columnSearch8.trim()) return allDealColumns;
    const searchLower = columnSearch8.toLowerCase();
    return allDealColumns.filter((col) => col.toLowerCase().includes(searchLower));
  }, [allDealColumns, columnSearch8]);

  const filteredColumns9 = useMemo(() => {
    if (!columnSearch9.trim()) return allDealColumns;
    const searchLower = columnSearch9.toLowerCase();
    return allDealColumns.filter((col) => col.toLowerCase().includes(searchLower));
  }, [allDealColumns, columnSearch9]);

  const handleColumn1Change = (column: string) => {
    setSelectedColumn1(column === selectedColumn1 ? "" : column);
  };

  const handleColumn2Change = (column: string) => {
    setSelectedColumn2(column === selectedColumn2 ? "" : column);
  };

  const handleColumn3Change = (column: string) => {
    setSelectedColumn3(column === selectedColumn3 ? "" : column);
  };

  const handleColumn4Change = (column: string) => {
    setSelectedColumn4(column === selectedColumn4 ? "" : column);
  };

  const handleColumn5Change = (column: string) => {
    setSelectedColumn5(column === selectedColumn5 ? "" : column);
  };

  const handleColumn6Change = (column: string) => {
    setSelectedColumn6(column === selectedColumn6 ? "" : column);
  };

  const handleColumn7Change = (column: string) => {
    setSelectedColumn7(column === selectedColumn7 ? "" : column);
  };

  const handleColumn8Change = (column: string) => {
    setSelectedColumn8(column === selectedColumn8 ? "" : column);
  };

  const handleColumn9Change = (column: string) => {
    setSelectedColumn9(column === selectedColumn9 ? "" : column);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const queryKey = { page, pageSize: PAGE_SIZE };
      const [, freshData] = await Promise.all([
        utils.dashboard.playground.cascataTest.invalidate(queryKey),
        utils.dashboard.playground.cascataTest.fetch({
          ...queryKey,
          bypassCache: true,
        }),
      ]);
      utils.dashboard.playground.cascataTest.setData(queryKey, freshData);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4 sm:space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div>No data available</div>
      </DashboardLayout>
    );
  }

  const { data: contacts, pagination } = data;
  const totalPages = pagination.totalPages;
  const totalResults = pagination.totalResults;

  // Define default values for highlighting
  const defaultValues = {
    column1: "property_admin_first_became_a_sql_date",
    column2: "property_admin_pod",
    column3: "property_sql_type",
    column4: "property_admin_first_became_an_opportunity_date",
    column5: "property_deal_geo_pods",
    column6: "property_dealtype",
    column7: "property_amount_in_home_currency",
    column8: "property_type_of_sql_associated_to_deal",
    column9: "property_closedate",
  };

  const isDefaultValue = (columnNum: number, value: string): boolean => {
    const key = `column${columnNum}` as keyof typeof defaultValues;
    return defaultValues[key] === value;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 md:space-y-8">
        {/* Welcome Section */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Configure Cascata Environment</h1>
          </div>
        </div>

        {/* Combined Table */}
        <Card>
          <CardHeader>
            <CardTitle>Model Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Question</TableHead>
                    <TableHead className="whitespace-nowrap">Property</TableHead>
                    <TableHead className="whitespace-nowrap">Column Selection</TableHead>
                    <TableHead className="whitespace-nowrap">Default Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Contacts Section Header */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={4} className="font-semibold">
                      Contacts
                    </TableCell>
                  </TableRow>
                  
                  {/* Question 1: SQL Field */}
                  <TableRow>
                    <TableCell className="font-medium">
                      Which field indicates when a contact became a Sales Qualified Lead (SQL)?
                    </TableCell>
                    <TableCell>Contacts</TableCell>
                    <TableCell className="text-left">
                      <Popover open={isColumnPopoverOpen} onOpenChange={setIsColumnPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Columns className="h-4 w-4 mr-2" />
                            {selectedColumn1 ? selectedColumn1 : "Select Column"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <div className="p-4 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Search and Select Column</Label>
                              <Input
                                placeholder="Search columns..."
                                value={columnSearch}
                                onChange={(e) => setColumnSearch(e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                          <ScrollArea className="h-[400px]">
                            <div className="p-2 space-y-1">
                              <RadioGroup value={selectedColumn1 || ""} onValueChange={handleColumn1Change}>
                                {filteredColumns.length > 0 ? (
                                  filteredColumns.map((column) => (
                                    <div
                                      key={column}
                                      className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                                      onClick={() => handleColumn1Change(column)}
                                    >
                                      <RadioGroupItem
                                        value={column}
                                        id={`column1-${column}`}
                                      />
                                      <label
                                        htmlFor={`column1-${column}`}
                                        className="text-sm cursor-pointer flex-1"
                                      >
                                        {column}
                                      </label>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm text-muted-foreground text-center">
                                    No columns found
                                  </div>
                                )}
                              </RadioGroup>
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      {selectedColumn1 && (
                        <span className={`text-xs px-2 py-1 rounded font-medium inline-block ${
                          isDefaultValue(1, selectedColumn1)
                            ? "bg-yellow-400 text-yellow-900 border border-yellow-500"
                            : "text-muted-foreground bg-muted"
                        }`}>
                          {selectedColumn1}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Question 2: Team Selection */}
                  <TableRow>
                    <TableCell className="font-medium">
                      Which field identifies the team or pod assignment for contacts?
                    </TableCell>
                    <TableCell>Contacts</TableCell>
                    <TableCell className="text-left">
                      <Popover open={isColumnPopoverOpen2} onOpenChange={setIsColumnPopoverOpen2}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Columns className="h-4 w-4 mr-2" />
                            {selectedColumn2 ? selectedColumn2 : "Select Column"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <div className="p-4 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Search and Select Column</Label>
                              <Input
                                placeholder="Search columns..."
                                value={columnSearch2}
                                onChange={(e) => setColumnSearch2(e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                          <ScrollArea className="h-[400px]">
                            <div className="p-2 space-y-1">
                              <RadioGroup value={selectedColumn2 || ""} onValueChange={handleColumn2Change}>
                                {filteredColumns2.length > 0 ? (
                                  filteredColumns2.map((column) => (
                                    <div
                                      key={column}
                                      className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                                      onClick={() => handleColumn2Change(column)}
                                    >
                                      <RadioGroupItem
                                        value={column}
                                        id={`column2-${column}`}
                                      />
                                      <label
                                        htmlFor={`column2-${column}`}
                                        className="text-sm cursor-pointer flex-1"
                                      >
                                        {column}
                                      </label>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm text-muted-foreground text-center">
                                    No columns found
                                  </div>
                                )}
                              </RadioGroup>
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      {selectedColumn2 && (
                        <span className={`text-xs px-2 py-1 rounded font-medium inline-block ${
                          isDefaultValue(2, selectedColumn2)
                            ? "bg-yellow-400 text-yellow-900 border border-yellow-500"
                            : "text-muted-foreground bg-muted"
                        }`}>
                          {selectedColumn2}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Question 3: SQL Types */}
                  <TableRow>
                    <TableCell className="font-medium">
                      Which field captures the SQL type classification?
                    </TableCell>
                    <TableCell>Contacts</TableCell>
                    <TableCell className="text-left">
                      <Popover open={isColumnPopoverOpen3} onOpenChange={setIsColumnPopoverOpen3}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Columns className="h-4 w-4 mr-2" />
                            {selectedColumn3 ? selectedColumn3 : "Select Column"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <div className="p-4 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Search and Select Column</Label>
                              <Input
                                placeholder="Search columns..."
                                value={columnSearch3}
                                onChange={(e) => setColumnSearch3(e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                          <ScrollArea className="h-[400px]">
                            <div className="p-2 space-y-1">
                              <RadioGroup value={selectedColumn3 || ""} onValueChange={handleColumn3Change}>
                                {filteredColumns3.length > 0 ? (
                                  filteredColumns3.map((column) => (
                                    <div
                                      key={column}
                                      className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                                      onClick={() => handleColumn3Change(column)}
                                    >
                                      <RadioGroupItem
                                        value={column}
                                        id={`column3-${column}`}
                                      />
                                      <label
                                        htmlFor={`column3-${column}`}
                                        className="text-sm cursor-pointer flex-1"
                                      >
                                        {column}
                                      </label>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm text-muted-foreground text-center">
                                    No columns found
                                  </div>
                                )}
                              </RadioGroup>
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      {selectedColumn3 && (
                        <span className={`text-xs px-2 py-1 rounded font-medium inline-block ${
                          isDefaultValue(3, selectedColumn3)
                            ? "bg-yellow-400 text-yellow-900 border border-yellow-500"
                            : "text-muted-foreground bg-muted"
                        }`}>
                          {selectedColumn3}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Question 4: Conversion Date Field */}
                  <TableRow>
                    <TableCell className="font-medium">
                      Which field tracks when a contact converted to an opportunity?
                    </TableCell>
                    <TableCell>Contacts</TableCell>
                    <TableCell className="text-left">
                      <Popover open={isColumnPopoverOpen4} onOpenChange={setIsColumnPopoverOpen4}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Columns className="h-4 w-4 mr-2" />
                            {selectedColumn4 ? selectedColumn4 : "Select Column"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <div className="p-4 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Search and Select Column</Label>
                              <Input
                                placeholder="Search columns..."
                                value={columnSearch4}
                                onChange={(e) => setColumnSearch4(e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                          <ScrollArea className="h-[400px]">
                            <div className="p-2 space-y-1">
                              <RadioGroup value={selectedColumn4 || ""} onValueChange={handleColumn4Change}>
                                {filteredColumns4.length > 0 ? (
                                  filteredColumns4.map((column) => (
                                    <div
                                      key={column}
                                      className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                                      onClick={() => handleColumn4Change(column)}
                                    >
                                      <RadioGroupItem
                                        value={column}
                                        id={`column4-${column}`}
                                      />
                                      <label
                                        htmlFor={`column4-${column}`}
                                        className="text-sm cursor-pointer flex-1"
                                      >
                                        {column}
                                      </label>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm text-muted-foreground text-center">
                                    No columns found
                                  </div>
                                )}
                              </RadioGroup>
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      {selectedColumn4 && (
                        <span className={`text-xs px-2 py-1 rounded font-medium inline-block ${
                          isDefaultValue(4, selectedColumn4)
                            ? "bg-yellow-400 text-yellow-900 border border-yellow-500"
                            : "text-muted-foreground bg-muted"
                        }`}>
                          {selectedColumn4}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Deals Section Header */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={4} className="font-semibold">
                      Deals
                    </TableCell>
                  </TableRow>

                  {/* Question 5: Deal Team Selection */}
                  <TableRow>
                    <TableCell className="font-medium">
                      Which field identifies the team or geographic pod for deals?
                    </TableCell>
                    <TableCell>Deals</TableCell>
                    <TableCell className="text-left">
                      <Popover open={isColumnPopoverOpen5} onOpenChange={setIsColumnPopoverOpen5}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Columns className="h-4 w-4 mr-2" />
                            {selectedColumn5 ? selectedColumn5 : "Select Column"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <div className="p-4 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Search and Select Column</Label>
                              <Input
                                placeholder="Search columns..."
                                value={columnSearch5}
                                onChange={(e) => setColumnSearch5(e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                          <ScrollArea className="h-[400px]">
                            <div className="p-2 space-y-1">
                              <RadioGroup value={selectedColumn5 || ""} onValueChange={handleColumn5Change}>
                                {filteredColumns5.length > 0 ? (
                                  filteredColumns5.map((column) => (
                                    <div
                                      key={column}
                                      className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                                      onClick={() => handleColumn5Change(column)}
                                    >
                                      <RadioGroupItem
                                        value={column}
                                        id={`column5-${column}`}
                                      />
                                      <label
                                        htmlFor={`column5-${column}`}
                                        className="text-sm cursor-pointer flex-1"
                                      >
                                        {column}
                                      </label>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm text-muted-foreground text-center">
                                    {isDealsLoading ? "Loading columns..." : "No columns found"}
                                  </div>
                                )}
                              </RadioGroup>
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      {selectedColumn5 && (
                        <span className={`text-xs px-2 py-1 rounded font-medium inline-block ${
                          isDefaultValue(5, selectedColumn5)
                            ? "bg-yellow-400 text-yellow-900 border border-yellow-500"
                            : "text-muted-foreground bg-muted"
                        }`}>
                          {selectedColumn5}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Question 6: Opportunity Types */}
                  <TableRow>
                    <TableCell className="font-medium">
                      Which field captures the deal type?
                    </TableCell>
                    <TableCell>Deals</TableCell>
                    <TableCell className="text-left">
                      <Popover open={isColumnPopoverOpen6} onOpenChange={setIsColumnPopoverOpen6}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Columns className="h-4 w-4 mr-2" />
                            {selectedColumn6 ? selectedColumn6 : "Select Column"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <div className="p-4 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Search and Select Column</Label>
                              <Input
                                placeholder="Search columns..."
                                value={columnSearch6}
                                onChange={(e) => setColumnSearch6(e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                          <ScrollArea className="h-[400px]">
                            <div className="p-2 space-y-1">
                              <RadioGroup value={selectedColumn6 || ""} onValueChange={handleColumn6Change}>
                                {filteredColumns6.length > 0 ? (
                                  filteredColumns6.map((column) => (
                                    <div
                                      key={column}
                                      className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                                      onClick={() => handleColumn6Change(column)}
                                    >
                                      <RadioGroupItem
                                        value={column}
                                        id={`column6-${column}`}
                                      />
                                      <label
                                        htmlFor={`column6-${column}`}
                                        className="text-sm cursor-pointer flex-1"
                                      >
                                        {column}
                                      </label>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm text-muted-foreground text-center">
                                    {isDealsLoading ? "Loading columns..." : "No columns found"}
                                  </div>
                                )}
                              </RadioGroup>
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      {selectedColumn6 && (
                        <span className={`text-xs px-2 py-1 rounded font-medium inline-block ${
                          isDefaultValue(6, selectedColumn6)
                            ? "bg-yellow-400 text-yellow-900 border border-yellow-500"
                            : "text-muted-foreground bg-muted"
                        }`}>
                          {selectedColumn6}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Question 7: ARR Field */}
                  <TableRow>
                    <TableCell className="font-medium">
                      Which field stores the Annual Recurring Revenue (ARR)?
                    </TableCell>
                    <TableCell>Deals</TableCell>
                    <TableCell className="text-left">
                      <Popover open={isColumnPopoverOpen7} onOpenChange={setIsColumnPopoverOpen7}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Columns className="h-4 w-4 mr-2" />
                            {selectedColumn7 ? selectedColumn7 : "Select Column"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <div className="p-4 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Search and Select Column</Label>
                              <Input
                                placeholder="Search columns..."
                                value={columnSearch7}
                                onChange={(e) => setColumnSearch7(e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                          <ScrollArea className="h-[400px]">
                            <div className="p-2 space-y-1">
                              <RadioGroup value={selectedColumn7 || ""} onValueChange={handleColumn7Change}>
                                {filteredColumns7.length > 0 ? (
                                  filteredColumns7.map((column) => (
                                    <div
                                      key={column}
                                      className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                                      onClick={() => handleColumn7Change(column)}
                                    >
                                      <RadioGroupItem
                                        value={column}
                                        id={`column7-${column}`}
                                      />
                                      <label
                                        htmlFor={`column7-${column}`}
                                        className="text-sm cursor-pointer flex-1"
                                      >
                                        {column}
                                      </label>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm text-muted-foreground text-center">
                                    {isDealsLoading ? "Loading columns..." : "No columns found"}
                                  </div>
                                )}
                              </RadioGroup>
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      {selectedColumn7 && (
                        <span className={`text-xs px-2 py-1 rounded font-medium inline-block ${
                          isDefaultValue(7, selectedColumn7)
                            ? "bg-yellow-400 text-yellow-900 border border-yellow-500"
                            : "text-muted-foreground bg-muted"
                        }`}>
                          {selectedColumn7}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Question 8: SQL Associated with Opportunity */}
                  <TableRow>
                    <TableCell className="font-medium">
                      Which field links the SQL type associated with this deal?
                    </TableCell>
                    <TableCell>Deals</TableCell>
                    <TableCell className="text-left">
                      <Popover open={isColumnPopoverOpen8} onOpenChange={setIsColumnPopoverOpen8}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Columns className="h-4 w-4 mr-2" />
                            {selectedColumn8 ? selectedColumn8 : "Select Column"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <div className="p-4 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Search and Select Column</Label>
                              <Input
                                placeholder="Search columns..."
                                value={columnSearch8}
                                onChange={(e) => setColumnSearch8(e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                          <ScrollArea className="h-[400px]">
                            <div className="p-2 space-y-1">
                              <RadioGroup value={selectedColumn8 || ""} onValueChange={handleColumn8Change}>
                                {filteredColumns8.length > 0 ? (
                                  filteredColumns8.map((column) => (
                                    <div
                                      key={column}
                                      className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                                      onClick={() => handleColumn8Change(column)}
                                    >
                                      <RadioGroupItem
                                        value={column}
                                        id={`column8-${column}`}
                                      />
                                      <label
                                        htmlFor={`column8-${column}`}
                                        className="text-sm cursor-pointer flex-1"
                                      >
                                        {column}
                                      </label>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm text-muted-foreground text-center">
                                    {isDealsLoading ? "Loading columns..." : "No columns found"}
                                  </div>
                                )}
                              </RadioGroup>
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      {selectedColumn8 && (
                        <span className={`text-xs px-2 py-1 rounded font-medium inline-block ${
                          isDefaultValue(8, selectedColumn8)
                            ? "bg-yellow-400 text-yellow-900 border border-yellow-500"
                            : "text-muted-foreground bg-muted"
                        }`}>
                          {selectedColumn8}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Question 9: Close Date Field */}
                  <TableRow>
                    <TableCell className="font-medium">
                      Which field tracks the expected close date?
                    </TableCell>
                    <TableCell>Deals</TableCell>
                    <TableCell className="text-left">
                      <Popover open={isColumnPopoverOpen9} onOpenChange={setIsColumnPopoverOpen9}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Columns className="h-4 w-4 mr-2" />
                            {selectedColumn9 ? selectedColumn9 : "Select Column"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <div className="p-4 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Search and Select Column</Label>
                              <Input
                                placeholder="Search columns..."
                                value={columnSearch9}
                                onChange={(e) => setColumnSearch9(e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                          <ScrollArea className="h-[400px]">
                            <div className="p-2 space-y-1">
                              <RadioGroup value={selectedColumn9 || ""} onValueChange={handleColumn9Change}>
                                {filteredColumns9.length > 0 ? (
                                  filteredColumns9.map((column) => (
                                    <div
                                      key={column}
                                      className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                                      onClick={() => handleColumn9Change(column)}
                                    >
                                      <RadioGroupItem
                                        value={column}
                                        id={`column9-${column}`}
                                      />
                                      <label
                                        htmlFor={`column9-${column}`}
                                        className="text-sm cursor-pointer flex-1"
                                      >
                                        {column}
                                      </label>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm text-muted-foreground text-center">
                                    {isDealsLoading ? "Loading columns..." : "No columns found"}
                                  </div>
                                )}
                              </RadioGroup>
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      {selectedColumn9 && (
                        <span className={`text-xs px-2 py-1 rounded font-medium inline-block ${
                          isDefaultValue(9, selectedColumn9)
                            ? "bg-yellow-400 text-yellow-900 border border-yellow-500"
                            : "text-muted-foreground bg-muted"
                        }`}>
                          {selectedColumn9}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Question 10: Deal Won Field (Non-configurable) */}
                  <TableRow>
                    <TableCell className="font-medium">
                      Which field indicates whether a deal has been won?
                    </TableCell>
                    <TableCell>Deals</TableCell>
                    <TableCell>
                      {/* Empty - no dropdown for this non-configurable field */}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-1 rounded font-medium bg-yellow-400 text-yellow-900 border border-yellow-500 font-mono inline-block">
                        deal_stage_value
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        (From deal_stage table)
                      </span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

