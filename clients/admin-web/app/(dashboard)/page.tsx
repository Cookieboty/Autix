export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold font-mono mb-6" style={{ color: '#7C3AED' }}>
        系统概览
      </h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: '用户总数', value: '-', desc: '系统注册用户' },
          { label: '角色数量', value: '-', desc: '已定义角色' },
          { label: '权限数量', value: '-', desc: '已定义权限' },
          { label: '在线设备', value: '-', desc: '当前活跃会话' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-white p-6">
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold font-mono" style={{ color: '#7C3AED' }}>
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-gray-400">{stat.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
