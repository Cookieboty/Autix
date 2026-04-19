import React from 'react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Card, Button } from '@heroui/react';
import { UITable, UIActionCallback } from '@/types/ai-ui';

interface DataTableProps extends UITable, UIActionCallback {}

export function DataTable({
  columns,
  rows,
  title,
  onAction,
  disabled,
}: DataTableProps) {
  const hasActions = rows.some(row => row.actions && row.actions.length > 0);
  
  return (
    <Card className="max-w-4xl">
      <Card.Content>
        {title && (
          <p className="text-base font-semibold mb-4">{title}</p>
        )}
        
        <Table aria-label={title || 'Data table'}>
          <TableHeader>
            {columns.map((column) => (
              <TableColumn key={column.key}>
                {column.label}
              </TableColumn>
            ))}
            {hasActions && (
              <TableColumn>操作</TableColumn>
            )}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {columns.map((column) => (
                  <TableCell key={column.key}>
                    {row.cells[column.key]?.toString() || ''}
                  </TableCell>
                ))}
                {hasActions && (
                  <TableCell>
                    {row.actions && row.actions.length > 0 && (
                      <div className="flex gap-2">
                        {row.actions.map((action, actionIndex) => (
                          <Button
                            key={actionIndex}
                            size="sm"
                            variant={action.variant === 'danger' ? 'danger' : 'ghost'}
                            onPress={() => onAction(action.action, { rowId: row.id, rowData: row.cells })}
                            isDisabled={disabled}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card.Content>
    </Card>
  );
}
