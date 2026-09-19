// 0x5a0160 Region_DilateRings size=2A6

char __stdcall sub_5A0160(int a1, int a2, int a3, int a4, int a5, int a6, char a7, char a8)
{
  _DWORD *v8; // esi
  _DWORD *v9; // ecx
  char v10; // dl
  _WORD *v11; // eax
  _WORD *v12; // edx
  __int16 v13; // cx
  int v14; // eax
  int v15; // edx
  char *v16; // esi
  int v17; // edi
  bool v18; // bl
  int *v19; // eax
  int *v20; // ebp
  int v21; // ecx
  int v22; // eax
  int v23; // eax
  int v24; // edx
  int v25; // edx
  _DWORD *v27; // [esp+10h] [ebp-1Ch]
  _DWORD *v28; // [esp+14h] [ebp-18h]
  int v29; // [esp+18h] [ebp-14h] BYREF
  int v30; // [esp+1Ch] [ebp-10h]
  int v31; // [esp+20h] [ebp-Ch]
  int v32; // [esp+24h] [ebp-8h]
  int i; // [esp+28h] [ebp-4h]

  v27 = (_DWORD *)sub_5A0700(a1);
  for ( i = 0; i < a2; ++i )
  {
    v8 = operator new(0x18u);
    if ( v8 != nullptr )
    {
      sub_42FCB0(0, 0);
      *v8 = &DynamicVectorClass<Cell>::`vftable';
      v8[5] = 10;
      v8[4] = 0;
      v28 = v8;
    }
    else
    {
      v28 = nullptr;
    }
    v9 = v27;
    v30 = 0;
    v28[5] = 3 * v27[4];
    if ( (int)v27[4] > 0 )
    {
      while ( 2 )
      {
        v10 = 0;
        v32 = 0;
        while ( 1 )
        {
          v11 = (_WORD *)(v9[1] + 4 * v30);
          v12 = (_WORD *)(4 * (v10 & 7) + 9041544);
          v13 = *v12 + *v11;
          LOWORD(v12) = v11[1] + v12[1];
          LOWORD(v31) = v13;
          HIWORD(v31) = (_WORD)v12;
          v29 = v31;
          v14 = (__int16)v12;
          v15 = (__int16)v12 + v13;
          if ( v15 > dword_ABED04
            && v13 - v14 < dword_ABED04
            && v14 - v13 < dword_ABED04
            && v15 <= dword_ABED08
            && v13 >= a3
            && v13 < a3 + a5
            && v14 >= a4
            && v14 < a6 + a4 )
          {
            v16 = (char *)dword_ABED10 + 80 * v13 + 80 * dword_89C2DC * v14;
            v17 = *((_DWORD *)v16 + 14);
            v18 = a7 != 0 && v17 == a1 - 1;
            v19 = (int *)sub_5657A0(&v29);
            v20 = v19;
            if ( (v17 == 0 || v18) && (sub_486380(v19) || v18 && sub_4865D0(v20)) )
            {
              v21 = v28[2];
              if ( v28[4] < v21
                || (*((_BYTE *)v28 + 13) != 0 || v21 == 0)
                && (v22 = v28[5]) > 0
                && (*(unsigned __int8 (__thiscall **)(_DWORD *, int, _DWORD))(*v28 + 8))(v28, v21 + v22, 0) != 0 )
              {
                v23 = v28[4];
                v24 = v28[1];
                v28[4] = v23 + 1;
                *(_DWORD *)(v24 + 4 * v23) = v29;
              }
              *((_DWORD *)v16 + 14) = a1;
              if ( a7 != 0 && sub_486380(v20) )
                *(_BYTE *)(sub_5657A0(&v29) + 283) = a8;
            }
            else if ( v17 != a1 )
            {
              if ( v27 != nullptr )
                (*(void (__thiscall **)(_DWORD *, int))*v27)(v27, 1);
              if ( v28 != nullptr )
                (*(void (__thiscall **)(_DWORD *, int))*v28)(v28, 1);
              return 0;
            }
          }
          v10 = ++v32;
          if ( v32 >= 8 )
            break;
          v9 = v27;
        }
        v9 = v27;
        v25 = v27[4];
        if ( ++v30 < v25 )
          continue;
        break;
      }
    }
    if ( v9 != nullptr )
      (*(void (__thiscall **)(_DWORD *, int))*v9)(v9, 1);
    v27 = v28;
  }
  if ( v27 != nullptr )
    (*(void (__thiscall **)(_DWORD *, int))*v27)(v27, 1);
  return 1;
}
