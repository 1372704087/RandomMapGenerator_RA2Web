// 0x5a0700 Boundary_Collector size=1CB

_DWORD *__thiscall sub_5A0700(_DWORD *this, int a2)
{
  _DWORD *v3; // ebx
  int v4; // ecx
  _DWORD *v5; // ebp
  int v6; // edi
  __int16 v7; // dx
  int v8; // eax
  int v9; // esi
  int v10; // ecx
  __int16 v11; // ax
  int v12; // edx
  int v13; // eax
  int v14; // ecx
  int v15; // eax
  int v16; // ecx
  int v17; // eax
  int v18; // eax
  int v19; // edx
  bool v20; // zf
  _DWORD *v22; // [esp+Ch] [ebp-10h]
  int v23; // [esp+10h] [ebp-Ch]
  int v24; // [esp+18h] [ebp-4h]

  v3 = operator new(0x18u);
  if ( v3 != nullptr )
  {
    sub_42FCB0(0, 0);
    *v3 = &DynamicVectorClass<Cell>::`vftable';
    v3[5] = 10;
    v3[4] = 0;
  }
  else
  {
    v3 = nullptr;
  }
  v22 = v3;
  v3[5] = *(this + 96) * *(this + 97);
  v4 = dword_89C2DC;
  if ( dword_89C2DC * dword_89C2DC <= 0 )
    return v3;
  v5 = dword_ABED10;
  v23 = 0;
  v24 = dword_89C2DC * dword_89C2DC;
  while ( 2 )
  {
    v6 = v5[v23];
    v7 = HIWORD(v6);
    if ( v6 == 0 )
      goto LABEL_33;
    v8 = v5 != nullptr ? v5[20 * (__int16)v6 + 14 + 20 * v4 * SHIWORD(v6)] : -1;
    if ( v8 != a2 )
      goto LABEL_33;
    v9 = 0;
    while ( 1 )
    {
      v10 = v9 & 7;
      v11 = LOWORD(dword_89F688[v10]) + v6;
      LOWORD(v10) = v7 + HIWORD(dword_89F688[v10]);
      v12 = v11;
      v13 = (__int16)v10;
      v14 = v12 + (__int16)v10;
      if ( v14 > dword_ABED04 )
      {
        if ( v12 - v13 < dword_ABED04 && v13 - v12 < dword_ABED04 && v14 <= dword_ABED08 )
          break;
        v3 = v22;
        v5 = dword_ABED10;
      }
LABEL_23:
      if ( ++v9 >= 8 )
        goto LABEL_33;
      v7 = HIWORD(v6);
    }
    v5 = dword_ABED10;
    if ( dword_ABED10 != nullptr )
      v15 = *((_DWORD *)dword_ABED10 + 20 * v12 + 20 * dword_89C2DC * v13 + 14);
    else
      v15 = -1;
    if ( v15 == a2 )
    {
      v3 = v22;
      goto LABEL_23;
    }
    v3 = v22;
    v16 = v22[2];
    if ( v22[4] < v16 )
      goto LABEL_31;
    if ( *((_BYTE *)v22 + 13) != 0 || v16 == 0 )
    {
      v17 = v22[5];
      if ( v17 > 0 )
      {
        if ( (*(unsigned __int8 (__thiscall **)(_DWORD *, int, _DWORD))(*v22 + 8))(v22, v16 + v17, 0) != 0 )
        {
LABEL_31:
          v18 = v22[4];
          v19 = v22[1];
          v22[4] = v18 + 1;
          *(_DWORD *)(v19 + 4 * v18) = v6;
        }
        v5 = dword_ABED10;
      }
    }
LABEL_33:
    v20 = v24 == 1;
    v23 += 20;
    --v24;
    if ( !v20 )
    {
      v4 = dword_89C2DC;
      continue;
    }
    return v3;
  }
}
