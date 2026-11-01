import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, Building2, CheckCircle2, ClipboardCheck, Download, ExternalLink, GraduationCap, LockKeyhole, Plus, Search, ShieldCheck, Users, X } from 'lucide-react';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { EDUKPI_APPLICATION_URL } from '../ecosystem';
import type { Teacher } from '../types';

type Props = {
  teachers: Teacher[];
  onAddTeacher: (school: string) => void;
  onEditTeacher: (teacher: Teacher) => void;
  onManageTeachers: (school: string) => void;
};

type SchoolGroup = {
  key: string;
  name: string;
  teachers: Teacher[];
  active: number;
  inactive: number;
  levels: string[];
};

type CountResult = { value: number | null; error: string | null };
type UsageCounts = { exams: CountResult; classes: CountResult; results: CountResult };

const panel='rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_14px_45px_-32px_rgba(15,23,42,.25)] sm:p-6';
const primary='inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700';
const secondary='inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50';

function schoolKey(value: string): string {
  return value.trim().replace(/\s+/g,' ').toLocaleLowerCase('vi');
}
function groupSchools(profiles: Teacher[]): SchoolGroup[] {
  const map=new Map<string,SchoolGroup>();
  for(const teacher of profiles){
    const name=typeof teacher.school==='string'?teacher.school.trim().replace(/\s+/g,' '):'';
    if(!name)continue;
    const key=schoolKey(name);
    const group=map.get(key)||{key,name,teachers:[],active:0,inactive:0,levels:[]};
    group.teachers.push(teacher);
    if(teacher.status==='active')group.active++;
    else group.inactive++;
    if(teacher.level&&!group.levels.includes(teacher.level))group.levels.push(teacher.level);
    map.set(key,group);
  }
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'vi'));
}
function escapeCsv(value: unknown): string {
  let text=String(value??'');
  // Prevent user-controlled school/teacher names from becoming formulas in Excel.
  if (/^[\s]*[=+\-@]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
function exportReport(schools:SchoolGroup[]): void {
  const lines=[
    ['Trường học','Số giáo viên','Đang kích hoạt','Đã khóa','Cấp học'],
    ...schools.map(s=>[s.name,s.teachers.length,s.active,s.inactive,s.levels.join(', ')]),
  ];
  const text='\uFEFF'+lines.map(row=>row.map(escapeCsv).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;link.download='Edu40_danh_sach_truong.csv';link.click();
  URL.revokeObjectURL(url);
}

async function countOwnedDocuments(collectionName:'exams'|'classes'|'results',uidList:string[]):Promise<CountResult>{
  if(uidList.length===0)return {value:0,error:null};
  try {
    let total=0;
    // Firestore 'in' supports 30 comparison values per query.
    for(let offset=0;offset<uidList.length;offset+=30){
      const batch=uidList.slice(offset,offset+30);
      const snapshot=await getCountFromServer(query(collection(db,collectionName),where('teacherId','in',batch)));
      total+=snapshot.data().count;
    }
    return {value:total,error:null};
  }catch(error){
    const message=error instanceof Error?error.message:'Không thể tải số liệu';
    return {value:null,error:message};
  }
}

export default function SchoolAdministration({teachers,onAddTeacher,onEditTeacher,onManageTeachers}:Props){
  const groups=useMemo(()=>groupSchools(teachers),[teachers]);
  const [filter,setFilter]=useState('');
  const [selectedKey,setSelectedKey]=useState<string|null>(null);
  const [statusFilter,setStatusFilter]=useState<'all'|'active'|'inactive'>('all');
  const [counts,setCounts]=useState<UsageCounts|null>(null);
  const [loadingCounts,setLoadingCounts]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const selected=groups.find(s=>s.key===selectedKey)||null;
  const unassigned=teachers.filter(t=>!(typeof t.school==='string'&&t.school.trim())).length;
  const totals={schools:groups.length,teachers:teachers.length,active:teachers.filter(t=>t.status==='active').length,inactive:teachers.filter(t=>t.status!=='active').length};
  const visible=groups.filter(s=>(s.name+' '+s.levels.join(' ')).toLocaleLowerCase('vi').includes(filter.trim().toLocaleLowerCase('vi')));
  const schoolTeachers=selected?.teachers.filter(t=>statusFilter==='all'||(statusFilter==='active'?t.status==='active':t.status!=='active'))||[];

  useEffect(()=>{
    if(!selected)return;
    let live=true;
    setLoadingCounts(true);setCounts(null);
    const ids=[...new Set(selected.teachers.map(t=>t.id).filter(Boolean))];
    void Promise.all([countOwnedDocuments('exams',ids),countOwnedDocuments('classes',ids),countOwnedDocuments('results',ids)]).then(([exams,classes,results])=>{
      if(live)setCounts({exams,classes,results});
    }).finally(()=>{if(live)setLoadingCounts(false);});
    return()=>{live=false;};
  },[selected?.key,selected?.teachers,refresh]);

  return <div className="min-h-full flex-1 overflow-y-auto bg-[#f6f8fc] p-4 md:p-7">
    <div className="mx-auto max-w-[1380px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-indigo-600">Quản trị hệ thống</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Quản trị trường học</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Danh sách trường và tình trạng tài khoản từ hệ thống giáo viên. Xem chi tiết từng trường và kiểm tra quy mô khai thác công cụ.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={()=>exportReport(visible)} className={secondary}><Download size={16}/> Xuất danh sách</button>
          <button type="button" onClick={()=>onAddTeacher(selected?.name||'')} className={primary}><Plus size={17}/> Cấp tài khoản trường</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {name:'Trường đã khai báo',value:totals.schools,info:'Theo đơn vị công tác của giáo viên',icon:Building2,tone:'bg-indigo-50 text-indigo-600'},
          {name:'Tài khoản giáo viên',value:totals.teachers,info:'Trong danh sách toàn hệ thống',icon:Users,tone:'bg-sky-50 text-sky-600'},
          {name:'Đang kích hoạt',value:totals.active,info:'Được cấp quyền đăng nhập',icon:CheckCircle2,tone:'bg-emerald-50 text-emerald-600'},
          {name:'Đã khóa / chưa kích hoạt',value:totals.inactive,info:'Không được phép sử dụng',icon:LockKeyhole,tone:'bg-amber-50 text-amber-600'},
        ].map(item=><section key={item.name} className={panel}>
          <span className={'inline-flex h-11 w-11 items-center justify-center rounded-2xl '+item.tone}><item.icon size={21}/></span>
          <p className="mt-4 text-xs font-bold leading-5 text-slate-500 sm:text-sm">{item.name}</p>
          <p className="mt-1 text-3xl font-black tracking-tight text-slate-900">{item.value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{item.info}</p>
        </section>)}
      </div>

      {unassigned>0&&<div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Có <strong>{unassigned}</strong> tài khoản chưa khai báo đơn vị công tác. Các tài khoản này không được gộp thành một trường giả định. <button className="font-bold underline" onClick={()=>onManageTeachers('')}>Xem và bổ sung trường</button>
      </div>}

      {!selected&&<section className={panel}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-extrabold text-slate-900">Danh sách các trường</h2><p className="mt-1 text-xs text-slate-500">Chọn một trường để xem giáo viên và thống kê hoạt động công cụ.</p></div>
          <label className="relative block w-full sm:w-72"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input aria-label="Tìm trường" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Tìm trường, cấp học..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-400"/></label>
        </div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr>
            <th className="px-4 py-3">Trường / đơn vị</th><th className="px-4 py-3">Cấp học</th><th className="px-4 py-3 text-center">Tài khoản</th><th className="px-4 py-3 text-center">Đang kích hoạt</th><th className="px-4 py-3 text-center">Đã khóa</th><th className="px-4 py-3">Chi tiết</th>
          </tr></thead>
          <tbody>{visible.map(group=><tr key={group.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
            <td className="px-4 py-4 font-bold text-slate-900">{group.name}</td>
            <td className="px-4 py-4 text-slate-600">{group.levels.join(', ')||'Chưa xác định'}</td>
            <td className="px-4 py-4 text-center font-semibold">{group.teachers.length}</td>
            <td className="px-4 py-4 text-center text-emerald-700">{group.active}</td>
            <td className="px-4 py-4 text-center text-amber-700">{group.inactive}</td>
            <td className="px-4 py-4"><button type="button" onClick={()=>{setSelectedKey(group.key);setStatusFilter('all');}} className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:underline">Giám sát <ArrowRight size={15}/></button></td>
          </tr>)}</tbody>
        </table>{visible.length===0&&<p className="py-10 text-center text-sm text-slate-500">Chưa có trường nào khớp bộ lọc. Có thể cấp tài khoản giáo viên kèm tên trường để bắt đầu.</p>}</div>
      </section>}

      {selected&&<>
        <section className={panel}>
          <button type="button" onClick={()=>{setSelectedKey(null);setCounts(null);}} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-indigo-700"><ArrowLeft size={16}/> Tất cả trường</button>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Hồ sơ đơn vị</p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">{selected.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{selected.levels.join(', ')||'Chưa rõ cấp học'} · {selected.teachers.length} tài khoản giáo viên</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={()=>onManageTeachers(selected.name)} className={secondary}>Quản lý giáo viên <ArrowRight size={16}/></button>
              <button type="button" onClick={()=>onAddTeacher(selected.name)} className={primary}><Plus size={15}/> Thêm giáo viên</button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl bg-indigo-50 p-4"><p className="text-xs font-semibold text-indigo-700">Giáo viên</p><p className="mt-1 text-2xl font-black text-indigo-900">{selected.teachers.length}</p></div>
            <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-700">Tài khoản được kích hoạt</p><p className="mt-1 text-2xl font-black text-emerald-900">{selected.active}</p></div>
            <div className="rounded-2xl bg-sky-50 p-4"><p className="text-xs font-semibold text-sky-700">Số kỳ thi đã tạo</p><p className="mt-1 text-2xl font-black text-sky-900">{loadingCounts?'…':counts?.exams.value??'—'}</p>{counts?.exams.error&&<p className="mt-1 text-xs text-rose-700">Chưa có quyền đọc số liệu</p>}</div>
            <div className="rounded-2xl bg-violet-50 p-4"><p className="text-xs font-semibold text-violet-700">Số lớp dữ liệu</p><p className="mt-1 text-2xl font-black text-violet-900">{loadingCounts?'…':counts?.classes.value??'—'}</p>{counts?.classes.error&&<p className="mt-1 text-xs text-rose-700">Chưa có quyền đọc số liệu</p>}</div>
            <div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-700">Kết quả bài thi đã ghi</p><p className="mt-1 text-2xl font-black text-amber-900">{loadingCounts?'…':counts?.results.value??'—'}</p>{counts?.results.error&&<p className="mt-1 text-xs text-rose-700">Chưa có quyền đọc số liệu</p>}</div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div><p className="font-bold text-slate-800">Kết quả KPI trường học</p><p className="mt-1 text-xs text-slate-500">Mở EduKPI AI để xem báo cáo và kết quả theo quyền của tài khoản đó.</p></div>
            <a href={EDUKPI_APPLICATION_URL} target="_blank" rel="noopener noreferrer" className={secondary}><BarChart3 size={16}/> Mở EduKPI AI <ExternalLink size={14}/></a>
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck size={16} className="shrink-0 text-indigo-600"/>
            Số kỳ thi, lớp và bản ghi kết quả được đếm trực tiếp từ Firebase theo tài khoản giáo viên của trường; không tải đề thi, đáp án hay bài làm. Chưa có chỉ số điểm trung bình hoặc lượt đăng nhập gần đây nên hệ thống không suy đoán các chỉ số đó.
          </p>
          <button type="button" onClick={()=>setRefresh(n=>n+1)} className="mt-3 text-xs font-semibold text-indigo-700 hover:underline">Làm mới thống kê hoạt động</button>
        </section>

        <section className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="text-lg font-extrabold text-slate-900">Nhân sự thuộc trường</h3><p className="mt-1 text-xs text-slate-500">Cập nhật trạng thái dựa trên hồ sơ tài khoản Firebase.</p></div>
            <select aria-label="Lọc tài khoản giáo viên" value={statusFilter} onChange={e=>setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <option value="all">Tất cả tài khoản</option><option value="active">Đang kích hoạt</option><option value="inactive">Đã khóa</option>
            </select>
          </div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-3">Họ và tên</th><th className="px-3 py-3">Email</th><th className="px-3 py-3">Cấp học</th><th className="px-3 py-3">Trạng thái</th><th className="px-3 py-3">Quản lý</th></tr></thead>
            <tbody>{schoolTeachers.map(person=><tr key={person.id} className="border-b border-slate-100"><td className="px-3 py-3 font-semibold text-slate-800">{person.name}</td><td className="px-3 py-3 text-slate-600">{person.email}</td><td className="px-3 py-3">{person.level}</td>
              <td className="px-3 py-3"><span className={'inline-block rounded-full px-2.5 py-1 text-xs font-semibold '+(person.status==='active'?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-600')}>{person.status==='active'?'Đang kích hoạt':'Đã khóa'}</span></td>
              <td className="px-3 py-3"><button type="button" onClick={()=>onEditTeacher(person)} className="font-semibold text-indigo-700 hover:underline">Chỉnh sửa</button></td>
            </tr>)}</tbody></table></div>
        </section>
      </>}
      <p className="text-xs leading-5 text-slate-500">Phạm vi giám sát hiện tại: hồ sơ giáo viên và số lượng kỳ thi, lớp, kết quả thi đã ghi. Tên trường được lấy từ trường “Đơn vị công tác”; hãy chuẩn hóa tên trường nếu có nhiều cách viết. Đây không phải dữ liệu điểm đánh giá xếp loại hoặc lượt đăng nhập thực tế.</p>
    </div>
  </div>;
}
