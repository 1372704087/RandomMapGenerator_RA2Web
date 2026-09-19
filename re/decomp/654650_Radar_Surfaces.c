// 0x654650 Radar_Surfaces size=16A

int __usercall sub_654650@<eax>(int a1@<ecx>, int a2@<ebx>)
{
  int result; // eax
  _DWORD *v4; // edi
  void (__thiscall ***v5)(_DWORD, int); // ecx
  int v6; // eax
  int v7; // ecx
  int v8; // eax
  int v9; // edx
  int v10; // ebx
  int v11; // edi
  void (__thiscall ***v12)(_DWORD, int); // ecx
  int v13; // edi
  int v14; // eax
  int v15; // eax
  int v16; // [esp-Ch] [ebp-2Ch]
  _DWORD v17[4]; // [esp+10h] [ebp-10h] BYREF

  result = *(_DWORD *)(a1 + 5284);
  v4 = (_DWORD *)(a1 + 5276);
  if ( result > 0 && *(int *)(a1 + 5288) > 0 )
  {
    v5 = *(void (__thiscall ****)(_DWORD, int))(a1 + 4640);
    *(_DWORD *)(a1 + 5280) = 0;
    *v4 = 0;
    if ( v5 != nullptr )
    {
      (**v5)(v5, 1);
      *(_DWORD *)(a1 + 4640) = 0;
    }
    if ( *(_DWORD *)(a1 + 4668) != 0 )
    {
      operator delete(*(void **)(a1 + 4668));
      *(_DWORD *)(a1 + 4668) = 0;
    }
    if ( *(_DWORD *)(a1 + 4724) != 0 )
    {
      operator delete(*(void **)(a1 + 4724));
      *(_DWORD *)(a1 + 4724) = 0;
    }
    sub_6547C0(v17, v4, v4, 1);
    v6 = (*(int (__thiscall **)(_DWORD, int))(**(_DWORD **)(a1 + 4640) + 124))(*(_DWORD *)(a1 + 4640), a2);
    v7 = *(_DWORD *)(a1 + 4640);
    *(_DWORD *)(a1 + 5284) = v6;
    v8 = (*(int (__thiscall **)(int))(*(_DWORD *)v7 + 128))(v7);
    v9 = *(_DWORD *)(a1 + 5284);
    v10 = *(_DWORD *)(a1 + 4592);
    *(_DWORD *)(a1 + 5288) = v8;
    *v4 = v10;
    if ( v9 < 140 )
      *v4 = v10 + (140 - v9) / 2;
    v11 = *(_DWORD *)(a1 + 4596);
    *(_DWORD *)(a1 + 5280) = v11;
    if ( v8 < 108 )
      *(_DWORD *)(a1 + 5280) = v11 + (108 - v8) / 2;
    v12 = *(void (__thiscall ****)(_DWORD, int))(a1 + 4636);
    if ( v12 != nullptr )
    {
      (**v12)(v12, 1);
      *(_DWORD *)(a1 + 4636) = 0;
    }
    if ( operator new(0x24u) != nullptr )
    {
      v17[0] = *(_DWORD *)(a1 + 4640);
      v13 = v17[0];
      v16 = (*(int (__thiscall **)(_DWORD))(*(_DWORD *)v17[0] + 128))(v17[0]);
      v14 = (*(int (__thiscall **)(int))(*(_DWORD *)v13 + 124))(v13);
      v15 = sub_4BA5A0(v14, v16, 1, 0);
    }
    else
    {
      v15 = 0;
    }
    *(_DWORD *)(a1 + 4636) = v15;
    (*(void (__thiscall **)(int, _DWORD))(*(_DWORD *)v15 + 24))(v15, 0);
    return sub_6563B0(a1);
  }
  return result;
}
