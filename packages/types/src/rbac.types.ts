export interface MenuTreeNode {
  id: string;
  name: string;
  path?: string;
  icon?: string;
  type: 'DIRECTORY' | 'MENU' | 'BUTTON';
  permissionCode?: string;
  isExternal: boolean;
  visible: boolean;
  sort: number;
  children?: MenuTreeNode[];
}

export interface PermissionGroup {
  module: string;
  permissions: {
    id: string;
    name: string;
    code: string;
    action: string;
  }[];
}
