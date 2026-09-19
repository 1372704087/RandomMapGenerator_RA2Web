// 0x58e740 Region_Bfs1 size=26D

char __thiscall sub_58E740(_DWORD *this, int a2)
{
  _DWORD *v2; // esi
  _DWORD *v3; // ebp
  int v4; // ecx
  int v5; // esi
  int v6; // ebx
  _WORD *v7; // eax
  __int16 v8; // dx
  int v9; // eax
  int v10; // edx
  int v11; // eax
  char *v12; // esi
  int v13; // edi
  _DWORD *v14; // eax
  int *v15; // eax
  int v16; // ecx
  int v17; // eax
  int v18; // eax
  int v19; // edx
  _DWORD *v20; // edi
  int v21; // edx
  int v23; // [esp+10h] [ebp-18h] BYREF
  int v24; // [esp+14h] [ebp-14h]
  _DWORD *v25; // [esp+18h] [ebp-10h]
  int v26; // [esp+1Ch] [ebp-Ch]
  int v27; // [esp+20h] [ebp-8h]
  int i; // [esp+24h] [ebp-4h]

  v25 = this;
  v24 = sub_58D410(this);
  for ( i = 0; i < a2; ++i )
  {
    v2 = operator new(0x18u);
    if ( v2 != nullptr )
    {
      sub_42FCB0(0, 0);
      *v2 = &DynamicVectorClass<Cell>::`vftable';
      v2[5] = 10;
      v2[4] = 0;
      v3 = v2;
    }
    else
    {
      v3 = nullptr;
    }
    v4 = v24;
    v26 = 0;
    v3[5] = 3 * *(_DWORD *)(v24 + 16);
    if ( *(int *)(v4 + 16) > 0 )
    {
      v5 = dword_ABED04;
      while ( 2 )
      {
        v6 = 0;
        while ( 1 )
        {
          v7 = (_WORD *)(*(_DWORD *)(v4 + 4) + 4 * v26);
          v8 = v7[1] + HIWORD(dword_89F688[v6 & 7]);
          LOWORD(v27) = LOWORD(dword_89F688[v6 & 7]) + *v7;
          HIWORD(v27) = v8;
          v23 = v27;
          v9 = v8;
          v10 = v8 + (__int16)v27;
          if ( v10 > v5 && (__int16)v27 - v9 < v5 && v9 - (__int16)v27 < v5 && v10 <= dword_ABED08 )
          {
            v11 = sub_5657A0(&v23);
            if ( *(char *)(v11 + 283) == v25[4] )
            {
              v12 = (char *)dword_ABED10 + 80 * (__int16)v23 + 80 * dword_89C2DC * SHIWORD(v23);
              v13 = *((_DWORD *)v12 + 14);
              if ( v13 == -1
                && ((v14 = (_DWORD *)sub_5657A0(&v23), sub_486380(v14))
                 || (v15 = (int *)sub_5657A0(&v23), sub_4867B0(v15))) )
              {
                v16 = v3[2];
                if ( v3[4] < v16
                  || (*((_BYTE *)v3 + 13) != 0 || v16 == 0)
                  && (v17 = v3[5]) > 0
                  && (*(unsigned __int8 (__thiscall **)(_DWORD *, int, _DWORD))(*v3 + 8))(v3, v16 + v17, 0) != 0 )
                {
                  v18 = v3[4];
                  v19 = v3[1];
                  v3[4] = v18 + 1;
                  *(_DWORD *)(v19 + 4 * v18) = v23;
                }
                v20 = v25;
                *((_DWORD *)v12 + 14) = v25[2];
                *(_BYTE *)(sub_5657A0(&v23) + 283) = *((_BYTE *)v20 + 16);
              }
              else if ( v13 != v25[2] )
              {
                if ( v24 != 0 )
                  (**(void (__thiscall ***)(int, int))v24)(v24, 1);
                if ( v3 != nullptr )
                  (*(void (__thiscall **)(_DWORD *, int))*v3)(v3, 1);
                return 0;
              }
            }
            v5 = dword_ABED04;
          }
          if ( ++v6 >= 8 )
            break;
          v4 = v24;
        }
        v4 = v24;
        v21 = *(_DWORD *)(v24 + 16);
        if ( ++v26 < v21 )
          continue;
        break;
      }
    }
    if ( v4 != 0 )
      (**(void (__thiscall ***)(int, int))v4)(v4, 1);
    v24 = (int)v3;
  }
  if ( v24 != 0 )
    (**(void (__thiscall ***)(int, int))v24)(v24, 1);
  return 1;
}
