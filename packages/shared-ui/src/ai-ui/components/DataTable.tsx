'use client';

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { useTranslations } from 'next-intl';
import { UITable, UIActionCallback } from '@autix/shared-lib';

interface DataTableProps extends UITable, UIActionCallback {}

export function DataTable({
  columns,
  rows,
  title,
  onAction,
  disabled,
}: DataTableProps) {
  const t = useTranslations('aiUi');
  const hasActions = rows.some(row => row.actions && row.actions.length > 0);

  return (
    <Card className="max-w-4xl">
      <CardContent>
        {title && (
          <p className="text-base font-semibold mb-4">{title}</p>
        )}

        <Table aria-label={title || 'Data table'}>
          <TableHeader>
            {columns.map((column) => (
              <TableHead key={column.key}>
                {column.label}
              </TableHead>
            ))}
            {hasActions && (
              <TableHead>{t('actions')}</TableHead>
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
                            variant={action.variant === 'danger' ? 'destructive' : 'ghost'}
                            onClick={() => onAction(action.action, { rowId: row.id, rowData: row.cells })}
                            disabled={disabled}
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
      </CardContent>
    </Card>
  );
}
